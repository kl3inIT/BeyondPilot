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

	/** The signed-in person's organization on the site; its solutions and use cases open under it. */
	private static final String MY_ORGANIZATION = "/workspace/organization";

	/** The signed-in person's talent profile on the site, with the messages people sent them. */
	private static final String MY_TALENT = "/workspace/talent";

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
	 * Tells an address that it was asked to join an organization. The link opens My organization, where the person who
	 * signs in with this address finds the invitation and answers it; the link itself accepts nothing.
	 * @param organizationName the organization that asks
	 * @param inviterName who asked, as they are shown
	 * @param owner whether the person is asked to own the organization, not only to belong to it
	 */
	@Transactional
	public void sendOrganizationInvitation(String recipient, String organizationName, String inviterName,
			boolean owner) {
		queue(EmailKind.ORGANIZATION_INVITATION, recipient,
				values("organizationName", organizationName, "inviterName", inviterName, "owner", owner,
						"organizationUrl", url(MY_ORGANIZATION)));
	}

	/**
	 * Tells an owner what GenAI Fund decided about their organization. An approval links to the organization's public
	 * page.
	 * @param slug the organization's address on the site, which the link of an approval opens
	 * @param approved whether the organization was approved; a refusal's reason is read after signing in
	 */
	@Transactional
	public void sendOrganizationDecision(String recipient, String organizationName, String slug, boolean approved) {
		queue(approved ? EmailKind.ORGANIZATION_APPROVED : EmailKind.ORGANIZATION_REFUSED, recipient,
				values("organizationName", organizationName, "organizationUrl", url("/organizations/" + slug)));
	}

	/** What GenAI Fund decided about a talent profile. */
	public enum TalentDecision {

		APPROVED, CHANGES_REQUESTED, REMOVED, RESTORED

	}

	/**
	 * Tells an owner that GenAI Fund sent their organization back with what to change. The link opens My organization,
	 * where they correct it.
	 * @param reason what GenAI Fund asks them to change
	 */
	@Transactional
	public void sendOrganizationSentBack(String recipient, String organizationName, String reason) {
		queue(EmailKind.ORGANIZATION_SENT_BACK, recipient,
				values("organizationName", organizationName, "reason", reason, "organizationUrl",
						url(MY_ORGANIZATION)));
	}

	/**
	 * Tells an owner that GenAI Fund took their organization down or restored it. The reason is read after signing in;
	 * a restoration links to the organization's public page.
	 * @param slug the organization's address on the site, which the link of a restoration opens
	 * @param takenDown whether the organization was taken down; otherwise it is back
	 */
	@Transactional
	public void sendOrganizationSuspension(String recipient, String organizationName, String slug,
			boolean takenDown) {
		queue(takenDown ? EmailKind.ORGANIZATION_TAKEN_DOWN : EmailKind.ORGANIZATION_RESTORED, recipient,
				values("organizationName", organizationName, "organizationUrl", url("/organizations/" + slug)));
	}

	/**
	 * Tells a member of an organization GenAI Fund merged into another that they are a member of that one now.
	 * @param keptName the organization kept, which the member belongs to from now on
	 */
	@Transactional
	public void sendOrganizationMerged(String recipient, String organizationName, String keptName) {
		queue(EmailKind.ORGANIZATION_MERGED, recipient,
				values("organizationName", organizationName, "keptName", keptName));
	}

	/**
	 * Tells a person the answer to their request to get into an organization. An approval links to My organization.
	 * @param claim whether they asked to own an organization nobody owned, which GenAI Fund decides; otherwise they
	 * asked its owners to join
	 * @param approved whether they are in now
	 */
	@Transactional
	public void sendOrganizationRequestDecision(String recipient, String organizationName, boolean claim,
			boolean approved) {
		queue(approved ? EmailKind.ORGANIZATION_REQUEST_APPROVED : EmailKind.ORGANIZATION_REQUEST_DECLINED, recipient,
				values("organizationName", organizationName, "claim", claim, "organizationUrl", url(MY_ORGANIZATION)));
	}

	/**
	 * Tells a person what GenAI Fund decided about their talent profile. The reason is read after signing in; the
	 * operator's note, when there is one, is quoted as written. The link opens the profile's public page when it has
	 * one, and otherwise the person's own talent profile, where they correct it.
	 * @param profileName the profile, as it names its person
	 * @param note what the operator wrote to the person; null when nothing
	 * @param publicSlug the profile's address in the directory; null while it is not shown there
	 */
	@Transactional
	public void sendTalentDecision(String recipient, String profileName, TalentDecision decision,
			@Nullable String note, @Nullable String publicSlug) {
		EmailKind kind = switch (decision) {
			case APPROVED -> EmailKind.TALENT_APPROVED;
			case CHANGES_REQUESTED -> EmailKind.TALENT_CHANGES_REQUESTED;
			case REMOVED -> EmailKind.TALENT_REMOVED;
			case RESTORED -> EmailKind.TALENT_RESTORED;
		};
		queue(kind, recipient, values("profileName", profileName, "note", note, "profileUrl",
				url(publicSlug == null ? MY_TALENT : "/talent/" + publicSlug)));
	}

	/**
	 * Tells a person with a talent profile that someone wrote to them. The sender's address is not in it: the link
	 * opens their talent profile, where they answer under Enquiries, and only an acceptance shares the two addresses.
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
						!"project".equals(topic) && !"role".equals(topic), "message", message, "enquiriesUrl",
						url(MY_TALENT)));
	}

	/** What GenAI Fund decided about a solution. */
	public enum SolutionDecision {

		APPROVED, SENT_BACK, REJECTED, TAKEN_DOWN, RESTORED

	}

	/**
	 * Tells a member of an organization what GenAI Fund decided about one of its solutions. What to change, when GenAI
	 * Fund sent it back, is quoted as written; any other reason is read after signing in. The link opens the solution's
	 * public page when it has one, and otherwise the solution in My organization, where a member edits it.
	 * @param reason what GenAI Fund asked to change, when it sent the solution back; null otherwise
	 * @param solutionId the solution, which the link opens in My organization
	 * @param publicSlug the solution's address on the site; null while it has no public page
	 */
	@Transactional
	public void sendSolutionDecision(String recipient, String organizationName, String solutionName,
			SolutionDecision decision, @Nullable String reason, UUID solutionId, @Nullable String publicSlug) {
		EmailKind kind = switch (decision) {
			case APPROVED -> EmailKind.SOLUTION_APPROVED;
			case SENT_BACK -> EmailKind.SOLUTION_SENT_BACK;
			case REJECTED -> EmailKind.SOLUTION_REJECTED;
			case TAKEN_DOWN -> EmailKind.SOLUTION_TAKEN_DOWN;
			case RESTORED -> EmailKind.SOLUTION_RESTORED;
		};
		queue(kind, recipient,
				values("solutionName", solutionName, "organizationName", organizationName, "reason", reason,
						"solutionUrl", url(publicSlug == null ? MY_ORGANIZATION + "/solutions/" + solutionId
								: "/solutions/" + publicSlug)));
	}

	/**
	 * Tells a member of an organization what GenAI Fund decided about one of its use cases. The reason, when GenAI
	 * Fund sent the use case back, is quoted as written. The link opens the published brief, or the use case in My
	 * organization, where a member edits one sent back.
	 * @param approved whether the use case was approved and published; otherwise it was sent back
	 * @param reason what GenAI Fund asked to change, when it sent the use case back
	 * @param useCaseId the use case, which the link opens
	 */
	@Transactional
	public void sendUseCaseDecision(String recipient, String organizationName, String useCaseTitle, boolean approved,
			@Nullable String reason, UUID useCaseId) {
		queue(approved ? EmailKind.USE_CASE_APPROVED : EmailKind.USE_CASE_SENT_BACK, recipient,
				values("useCaseTitle", useCaseTitle, "organizationName", organizationName, "reason", reason,
						"useCaseUrl", url((approved ? "/use-cases/" : MY_ORGANIZATION + "/use-cases/") + useCaseId)));
	}

	/**
	 * Reminds a person that a message waits for their answer and when it closes. The link opens their talent profile,
	 * where they answer under Enquiries.
	 * @param senderName who wrote, by the name they gave; null when they gave none, never their address
	 * @param daysLeft the whole days before the message closes unanswered
	 */
	@Transactional
	public void sendTalentEnquiryReminder(String recipient, @Nullable String senderName, long daysLeft) {
		queue(EmailKind.TALENT_ENQUIRY_REMINDER, recipient,
				values("senderName", senderName, "daysLeft", Long.toString(daysLeft), "enquiriesUrl",
						url(MY_TALENT)));
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
	 * reported is not exposed. It carries no address and no reason; the link opens the messages the sender sent.
	 * @param talentName the person written to, as their profile names them
	 */
	@Transactional
	public void sendTalentEnquiryDeclined(String recipient, String talentName) {
		queue(EmailKind.TALENT_ENQUIRY_DECLINED, recipient,
				values("talentName", talentName, "messagesUrl", url(MY_TALENT + "/sent")));
	}

	/**
	 * Tells the sender that their message closed because the person did not answer in time. They may write again; the
	 * link opens the messages they sent.
	 * @param talentName the person written to, as their profile names them
	 */
	@Transactional
	public void sendTalentEnquiryClosed(String recipient, String talentName) {
		queue(EmailKind.TALENT_ENQUIRY_CLOSED, recipient,
				values("talentName", talentName, "messagesUrl", url(MY_TALENT + "/sent")));
	}

	/**
	 * Confirms to an applicant that their application reached the program. The link opens the application after signing
	 * in, so a person who closed the page comes back to it; it acts on nothing.
	 * @param applicationId the application, which the link opens
	 * @param version which submission this is: 1 for the first, more when it was submitted again
	 * @param editableUntil until when the application can still change; null when it cannot
	 */
	@Transactional
	public void sendApplicationReceived(String recipient, String programName, UUID applicationId, int version,
			@Nullable Instant editableUntil) {
		String until = editableUntil == null ? null
				: DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale.ENGLISH)
					.withZone(VIETNAM)
					.format(editableUntil) + " ICT";
		queue(EmailKind.APPLICATION_RECEIVED, recipient,
				values("programName", programName, "resubmitted", version > 1, "editableUntil", until,
						"applicationUrl", applicationUrl(applicationId)));
	}

	/**
	 * Tells a member of the team of a proposal that it was sent, with the role they are named for. The link opens the
	 * proposal after signing in; it acts on nothing.
	 * @param organizationName the organization that sent it
	 * @param role the role typed for this person on the team; null when the sender is not on it
	 * @param primary whether this person is the primary contact
	 * @param senderName who sent it, as they are shown; null when the recipient is the sender
	 * @param useCaseId the use case the proposal went to
	 * @param editableUntil until when the proposal can still change; null when it cannot
	 */
	@Transactional
	public void sendProposalSent(String recipient, String useCaseTitle, String organizationName,
			@Nullable String role, boolean primary, @Nullable String senderName, UUID useCaseId, @Nullable Instant editableUntil) {
		String until = editableUntil == null ? null
				: DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale.ENGLISH)
					.withZone(VIETNAM)
					.format(editableUntil) + " ICT";
		queue(EmailKind.PROPOSAL_SENT, recipient,
				values("useCaseTitle", useCaseTitle, "organizationName", organizationName, "role", role, "primary",
						primary, "senderName", senderName, "editableUntil", until, "proposalUrl",
						url("/use-cases/" + useCaseId + "/propose/view")));
	}

	/**
	 * Tells an address that it was asked to judge a program's applications. The link opens the program's applications
	 * under Reviews; like an organization invitation it carries nothing that lets anyone in, and only the person who
	 * signs in with this address reads them.
	 * @param programId the program, whose applications the link opens
	 * @param inviterName who asked, as they are shown
	 * @param expiresAt when the invitation lapses if nobody signs in with the address
	 */
	@Transactional
	public void sendReviewerInvitation(String recipient, String programName, UUID programId, String inviterName,
			Instant expiresAt) {
		String until = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH).withZone(VIETNAM).format(expiresAt);
		queue(EmailKind.REVIEWER_INVITATION, recipient,
				values("programName", programName, "inviterName", inviterName, "expiresOn", until, "reviewsUrl",
						url("/reviews/" + programId)));
	}

	/**
	 * Sends an applicant the outcome of their application, as the operator wrote it for the applicant's group. The
	 * message is plain text; its line breaks are kept. A link to the application follows it, which opens after signing
	 * in and acts on nothing.
	 * @param applicationId the application, which the link opens
	 */
	@Transactional
	public void sendApplicationOutcome(String recipient, String subject, String message, UUID applicationId) {
		queue(EmailKind.APPLICATION_OUTCOME, recipient, values("subject", subject, "message", message.strip(),
				"applicationUrl", applicationUrl(applicationId)));
	}

	/** Where an applicant reads their own application on the site. */
	private String applicationUrl(UUID applicationId) {
		return url("/applications/" + applicationId);
	}

	/** The address of a page of the site, which is where every link of an email leads. */
	private String url(String path) {
		return settings.appearance().siteUrl() + path;
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
