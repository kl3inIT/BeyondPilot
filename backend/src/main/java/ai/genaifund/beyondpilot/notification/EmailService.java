package ai.genaifund.beyondpilot.notification;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.notification.adapter.EmailDeliveryException.DeliveryFailure;
import ai.genaifund.beyondpilot.notification.delivery.EmailDelivery;
import ai.genaifund.beyondpilot.notification.delivery.EmailQueued;
import ai.genaifund.beyondpilot.notification.persistence.EmailMessageRepository;
import ai.genaifund.beyondpilot.notification.persistence.EmailSuppressionRepository;
import ai.genaifund.beyondpilot.notification.settings.DeliverySettings;
import ai.genaifund.beyondpilot.notification.template.EmailKind;
import ai.genaifund.beyondpilot.notification.template.EmailRenderer;
import ai.genaifund.beyondpilot.notification.template.EmailTemplates;
import ai.genaifund.beyondpilot.notification.template.RenderedEmail;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The emails the application sends. Each method renders its kind of email from the wording in use and queues it in
 * the caller's transaction: a change that rolls back sends nothing, and the email leaves after the change commits,
 * through the provider operators configured. A failure to deliver never undoes the caller's change.
 */
@Service
@EnableConfigurationProperties(NotificationProperties.class)
public class EmailService {

	private static final Logger LOG = LoggerFactory.getLogger(EmailService.class);

	/** Deadlines are set in Vietnam time, whoever reads them. */
	private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

	/** What the log keeps of a sign-in code in place of the code. */
	private static final String MASKED_CODE = "••••••";

	private final EmailRenderer renderer;

	private final EmailTemplates templates;

	private final DeliverySettings settings;

	private final EmailMessageRepository messages;

	private final EmailSuppressionRepository suppressions;

	private final EmailDelivery delivery;

	private final ApplicationEventPublisher events;

	EmailService(EmailRenderer renderer, EmailTemplates templates, DeliverySettings settings,
			EmailMessageRepository messages, EmailSuppressionRepository suppressions, EmailDelivery delivery,
			ApplicationEventPublisher events) {
		this.renderer = renderer;
		this.templates = templates;
		this.settings = settings;
		this.messages = messages;
		this.suppressions = suppressions;
		this.delivery = delivery;
		this.events = events;
	}

	/**
	 * Sends the code that signs its recipient in, before returning: the person waits on the screen for it. The log
	 * keeps the email with the code masked.
	 * @throws NotificationException when the code could not be sent
	 */
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	void sendSignInCode(String recipient, String code, Duration validFor) {
		long minutes = Math.max(1, validFor.toMinutes());
		UUID id = UUID.randomUUID();
		RenderedEmail sent = render(EmailKind.SIGN_IN_CODE, Map.of("code", code, "minutes", Long.toString(minutes)));
		if (suppressions.isSuppressed(recipient)) {
			RenderedEmail logged = masked(minutes);
			messages.insertSkipped(id, EmailKind.SIGN_IN_CODE.value(), recipient, logged.subject(), logged.html(),
					logged.text(), DeliveryFailure.SUPPRESSED.value());
			throw notSent(DeliveryFailure.SUPPRESSED);
		}
		RenderedEmail logged = masked(minutes);
		messages.insertQueued(id, EmailKind.SIGN_IN_CODE.value(), recipient, logged.subject(), logged.html(),
				logged.text());
		delivery.sendNow(id, sent).ifPresent(failure -> {
			throw notSent(failure);
		});
	}

	/**
	 * Tells an address that it was asked to join an organization. The email carries no link that acts: the person
	 * signs in with this address and finds the invitation there.
	 * @param organizationName the organization that asks
	 * @param inviterName who asked, as they are shown
	 * @param owner whether the person is asked to own the organization, not only to belong to it
	 */
	@Transactional
	public void sendOrganizationInvitation(String recipient, String organizationName, String inviterName,
			boolean owner) {
		queue(EmailKind.ORGANIZATION_INVITATION, recipient,
				values("organizationName", organizationName, "inviterName", inviterName, "owner", owner));
	}

	/**
	 * Tells an owner what GenAI Fund decided about their organization.
	 * @param approved whether the organization was approved; a refusal's reason is read after signing in
	 */
	@Transactional
	public void sendOrganizationDecision(String recipient, String organizationName, boolean approved) {
		queue(approved ? EmailKind.ORGANIZATION_APPROVED : EmailKind.ORGANIZATION_REFUSED, recipient,
				values("organizationName", organizationName));
	}

	/** What GenAI Fund decided about a talent profile. */
	public enum TalentDecision {

		APPROVED, CHANGES_REQUESTED, REMOVED, RESTORED

	}

	/**
	 * Tells an owner that GenAI Fund sent their organization back with what to change.
	 * @param reason what GenAI Fund asks them to change
	 */
	@Transactional
	public void sendOrganizationSentBack(String recipient, String organizationName, String reason) {
		queue(EmailKind.ORGANIZATION_SENT_BACK, recipient,
				values("organizationName", organizationName, "reason", reason));
	}

	/**
	 * Tells an owner that GenAI Fund took their organization down or restored it. The reason is read after signing in.
	 * @param takenDown whether the organization was taken down; otherwise it is back
	 */
	@Transactional
	public void sendOrganizationSuspension(String recipient, String organizationName, boolean takenDown) {
		queue(takenDown ? EmailKind.ORGANIZATION_TAKEN_DOWN : EmailKind.ORGANIZATION_RESTORED, recipient,
				values("organizationName", organizationName));
	}

	/**
	 * Tells a person the answer to their request to get into an organization.
	 * @param claim whether they asked to own an organization nobody owned, which GenAI Fund decides; otherwise they
	 * asked its owners to join
	 * @param approved whether they are in now
	 */
	@Transactional
	public void sendOrganizationRequestDecision(String recipient, String organizationName, boolean claim,
			boolean approved) {
		queue(approved ? EmailKind.ORGANIZATION_REQUEST_APPROVED : EmailKind.ORGANIZATION_REQUEST_DECLINED, recipient,
				values("organizationName", organizationName, "claim", claim));
	}

	/**
	 * Tells a person what GenAI Fund decided about their talent profile. The reason is read after signing in; the
	 * operator's note, when there is one, is quoted as written.
	 * @param profileName the profile, as it names its person
	 * @param note what the operator wrote to the person; null when nothing
	 */
	@Transactional
	public void sendTalentDecision(String recipient, String profileName, TalentDecision decision,
			@Nullable String note) {
		EmailKind kind = switch (decision) {
			case APPROVED -> EmailKind.TALENT_APPROVED;
			case CHANGES_REQUESTED -> EmailKind.TALENT_CHANGES_REQUESTED;
			case REMOVED -> EmailKind.TALENT_REMOVED;
			case RESTORED -> EmailKind.TALENT_RESTORED;
		};
		queue(kind, recipient, values("profileName", profileName, "note", note));
	}

	/**
	 * Tells a person with a talent profile that someone wrote to them. The sender's address is not in it: the person
	 * signs in and answers under their talent profile, and only an acceptance shares the two addresses.
	 * @param senderName who wrote, by the name they gave, never their address
	 * @param senderOrganization the organization the sender belongs to; null when none
	 * @param topic what the message is about: {@code project}, {@code role} or {@code other}
	 * @param message what the sender wrote
	 */
	@Transactional
	public void sendTalentEnquiry(String recipient, @Nullable String senderName, @Nullable String senderOrganization,
			String topic, String message) {
		queue(EmailKind.TALENT_ENQUIRY, recipient,
				values("senderName", senderName, "senderOrganization", senderOrganization, "aboutProject",
						"project".equals(topic), "aboutRole", "role".equals(topic), "aboutOther",
						!"project".equals(topic) && !"role".equals(topic), "message", message));
	}

	/** What GenAI Fund decided about a solution. */
	public enum SolutionDecision {

		APPROVED, SENT_BACK, REJECTED, TAKEN_DOWN, RESTORED

	}

	/**
	 * Tells a member of an organization what GenAI Fund decided about one of its solutions. What to change, when GenAI
	 * Fund sent it back, is quoted as written; any other reason is read after signing in.
	 * @param reason what GenAI Fund asked to change, when it sent the solution back; null otherwise
	 */
	@Transactional
	public void sendSolutionDecision(String recipient, String organizationName, String solutionName,
			SolutionDecision decision, @Nullable String reason) {
		EmailKind kind = switch (decision) {
			case APPROVED -> EmailKind.SOLUTION_APPROVED;
			case SENT_BACK -> EmailKind.SOLUTION_SENT_BACK;
			case REJECTED -> EmailKind.SOLUTION_REJECTED;
			case TAKEN_DOWN -> EmailKind.SOLUTION_TAKEN_DOWN;
			case RESTORED -> EmailKind.SOLUTION_RESTORED;
		};
		queue(kind, recipient,
				values("solutionName", solutionName, "organizationName", organizationName, "reason", reason));
	}

	/**
	 * Tells a member of an organization what GenAI Fund decided about one of its use cases. The reason, when GenAI
	 * Fund sent the use case back, is quoted as written.
	 * @param approved whether the use case was approved and published; otherwise it was sent back
	 * @param reason what GenAI Fund asked to change, when it sent the use case back
	 */
	@Transactional
	public void sendUseCaseDecision(String recipient, String organizationName, String useCaseTitle, boolean approved,
			@Nullable String reason) {
		queue(approved ? EmailKind.USE_CASE_APPROVED : EmailKind.USE_CASE_SENT_BACK, recipient,
				values("useCaseTitle", useCaseTitle, "organizationName", organizationName, "reason", reason));
	}

	/**
	 * Reminds a person that a message waits for their answer and when it closes.
	 * @param senderName who wrote, by the name they gave; null when they gave none, never their address
	 * @param daysLeft the whole days before the message closes unanswered
	 */
	@Transactional
	public void sendTalentEnquiryReminder(String recipient, @Nullable String senderName, long daysLeft) {
		queue(EmailKind.TALENT_ENQUIRY_REMINDER, recipient,
				values("senderName", senderName, "daysLeft", Long.toString(daysLeft)));
	}

	/**
	 * Introduces the two sides of a message the person accepted: each is told who the other is and where to write.
	 * @param otherName who the recipient is introduced to, as they are shown
	 * @param otherEmail where the recipient writes to them
	 * @param otherOrganization the organization the other person belongs to; null when none or not known
	 */
	@Transactional
	public void sendTalentIntroduction(String recipient, String otherName, String otherEmail,
			@Nullable String otherOrganization) {
		queue(EmailKind.TALENT_INTRODUCTION, recipient,
				values("otherName", otherName, "otherEmail", otherEmail, "otherOrganization", otherOrganization));
	}

	/**
	 * Tells the sender that the person will not take their message further. A report reads the same, so the person who
	 * reported is not exposed. It carries no address and no reason.
	 * @param talentName the person written to, as their profile names them
	 */
	@Transactional
	public void sendTalentEnquiryDeclined(String recipient, String talentName) {
		queue(EmailKind.TALENT_ENQUIRY_DECLINED, recipient, values("talentName", talentName));
	}

	/**
	 * Tells the sender that their message closed because the person did not answer in time. They may write again.
	 * @param talentName the person written to, as their profile names them
	 */
	@Transactional
	public void sendTalentEnquiryClosed(String recipient, String talentName) {
		queue(EmailKind.TALENT_ENQUIRY_CLOSED, recipient, values("talentName", talentName));
	}

	/**
	 * Tells an owner of a provider that someone asked for an introduction. The sender's address is not in it: the owner
	 * signs in and answers, and only then do both sides learn each other's address.
	 * @param senderName who asks; null until they gave a name
	 * @param senderOrganization the organization they ask as
	 * @param solutionName what they asked about
	 * @param message what the sender needs
	 */
	@Transactional
	public void sendIntroductionRequest(String recipient, @Nullable String senderName, String senderOrganization,
			String solutionName, String message) {
		queue(EmailKind.INTRODUCTION_REQUEST, recipient, values("senderName", senderName, "senderOrganization",
				senderOrganization, "solutionName", solutionName, "message", message));
	}

	/**
	 * Introduces two people once the provider answered: each is told who the other is and where to write.
	 * @param otherName who the recipient is introduced to; null until they gave a name
	 * @param otherEmail where the recipient writes to them
	 * @param otherOrganization the organization the other person acts for
	 * @param solutionName the solution the introduction is about
	 */
	@Transactional
	public void sendIntroduction(String recipient, @Nullable String otherName, String otherEmail,
			String otherOrganization, String solutionName) {
		queue(EmailKind.INTRODUCTION_MADE, recipient, values("otherName", otherName, "otherEmail", otherEmail,
				"otherOrganization", otherOrganization, "solutionName", solutionName));
	}

	/**
	 * Tells the sender that the provider will not take their request further. It carries no address and no reason.
	 */
	@Transactional
	public void sendIntroductionDeclined(String recipient, String providerName, String solutionName) {
		queue(EmailKind.INTRODUCTION_DECLINED, recipient,
				values("providerName", providerName, "solutionName", solutionName));
	}

	/**
	 * Confirms to an applicant that their application reached the program.
	 * @param version which submission this is: 1 for the first, more when it was submitted again
	 * @param editableUntil until when the application can still change; null when it cannot
	 */
	@Transactional
	public void sendApplicationReceived(String recipient, String programName, int version,
			@Nullable Instant editableUntil) {
		String until = editableUntil == null ? null
				: DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale.ENGLISH)
					.withZone(VIETNAM)
					.format(editableUntil) + " ICT";
		queue(EmailKind.APPLICATION_RECEIVED, recipient,
				values("programName", programName, "resubmitted", version > 1, "editableUntil", until));
	}

	/**
	 * Tells an address that it was asked to judge a program's applications. Like an organization invitation it carries
	 * no link that acts: the person signs in with this address and finds the program under Reviews.
	 * @param inviterName who asked, as they are shown
	 * @param expiresAt when the invitation lapses if nobody signs in with the address
	 */
	@Transactional
	public void sendReviewerInvitation(String recipient, String programName, String inviterName, Instant expiresAt) {
		String until = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH).withZone(VIETNAM).format(expiresAt);
		queue(EmailKind.REVIEWER_INVITATION, recipient,
				values("programName", programName, "inviterName", inviterName, "expiresOn", until));
	}

	/**
	 * Sends an applicant the outcome of their application, as the operator wrote it for the applicant's group. The
	 * message is plain text; its line breaks are kept.
	 */
	@Transactional
	public void sendApplicationOutcome(String recipient, String subject, String message) {
		queue(EmailKind.APPLICATION_OUTCOME, recipient, values("subject", subject, "message", message.strip()));
	}

	private void queue(EmailKind kind, String recipient, Map<String, @Nullable Object> values) {
		RenderedEmail email = render(kind, values);
		UUID id = UUID.randomUUID();
		if (suppressions.isSuppressed(recipient)) {
			messages.insertSkipped(id, kind.value(), recipient, email.subject(), email.html(), email.text(),
					DeliveryFailure.SUPPRESSED.value());
			LOG.atInfo()
				.addKeyValue("event", "notification.email.skipped")
				.addKeyValue("email_id", id)
				.addKeyValue("email_kind", kind.value())
				.log("Email not sent to a suppressed address");
			return;
		}
		messages.insertQueued(id, kind.value(), recipient, email.subject(), email.html(), email.text());
		events.publishEvent(new EmailQueued(id));
	}

	private RenderedEmail render(EmailKind kind, Map<String, ?> values) {
		return renderer.render(kind, templates.current(kind), values, settings.appearance());
	}

	private RenderedEmail masked(long minutes) {
		return render(EmailKind.SIGN_IN_CODE, Map.of("code", MASKED_CODE, "minutes", Long.toString(minutes)));
	}

	private static NotificationException notSent(DeliveryFailure failure) {
		return new NotificationException(NotificationErrorCode.EMAIL_NOT_SENT,
				"The sign-in code was not sent: " + failure.value());
	}

	/** Pairs of name and value; a value may be null when the variable is absent. */
	private static Map<String, @Nullable Object> values(@Nullable Object... pairs) {
		Map<String, @Nullable Object> values = new HashMap<>();
		for (int index = 0; index < pairs.length; index += 2) {
			values.put((String) pairs[index], pairs[index + 1]);
		}
		return values;
	}

}
