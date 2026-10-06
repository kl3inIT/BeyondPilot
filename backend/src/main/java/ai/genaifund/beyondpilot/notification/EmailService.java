package ai.genaifund.beyondpilot.notification;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

/**
 * The emails the application sends. Delivery goes over SMTP, so the mail provider is a matter of configuration.
 */
@Service
@EnableConfigurationProperties(NotificationProperties.class)
public class EmailService {

	private static final Logger LOG = LoggerFactory.getLogger(EmailService.class);

	/** Deadlines are set in Vietnam time, whoever reads them. */
	private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

	private final JavaMailSender mailSender;
	private final NotificationProperties properties;

	EmailService(JavaMailSender mailSender, NotificationProperties properties) {
		this.mailSender = mailSender;
		this.properties = properties;
	}

	/**
	 * Sends the code that signs its recipient in.
	 * @param recipient the address the code is sent to
	 * @param code the code to type into the screen that is waiting for it
	 * @param validFor how long the code works
	 * @param locale the language of the email; Vietnamese for {@code vi}, English otherwise
	 */
	public void sendSignInCode(String recipient, String code, Duration validFor, Locale locale) {
		SignInCodeEmail email = SignInCodeEmail.of(code, validFor, locale);
		send("sign_in_code", recipient, email.subject(), email.text(), email.html());
	}

	/**
	 * Tells an address that it was asked to join an organization. The email carries no link that acts: the person signs
	 * in with this address and finds the invitation there. Its language is not known, so it is written in both.
	 * @param organizationName the organization that asks
	 * @param inviterName who asked, as they are shown
	 * @param owner whether the person is asked to own the organization, not only to belong to it
	 */
	public void sendOrganizationInvitation(String recipient, String organizationName, String inviterName,
			boolean owner) {
		String english = inviterName + " invited you to " + (owner ? "own " : "join ") + organizationName
				+ " on BeyondPilot. Sign in with this email address to accept or decline.";
		String vietnamese = inviterName + " mời bạn " + (owner ? "làm chủ sở hữu " : "tham gia ") + organizationName
				+ " trên BeyondPilot. Hãy đăng nhập bằng địa chỉ email này để chấp nhận hoặc từ chối.";
		send("organization_invitation", recipient, "You are invited to " + organizationName + " on BeyondPilot",
				english + "\n\n" + vietnamese + "\n", paragraphs(english, vietnamese));
	}

	/**
	 * Tells an owner what GenAI Fund decided about their organization, in both languages.
	 * @param approved whether the organization was approved; a refusal's reason is read after signing in
	 */
	public void sendOrganizationDecision(String recipient, String organizationName, boolean approved) {
		String english = approved
				? organizationName + " has been approved on BeyondPilot. Sign in to manage it."
				: organizationName + " was not approved on BeyondPilot. Sign in to read why and to correct it.";
		String vietnamese = approved
				? organizationName + " đã được duyệt trên BeyondPilot. Hãy đăng nhập để quản lý."
				: organizationName + " chưa được duyệt trên BeyondPilot. Hãy đăng nhập để xem lý do và chỉnh sửa.";
		send("organization_decision", recipient, organizationName + " on BeyondPilot",
				english + "\n\n" + vietnamese + "\n", paragraphs(english, vietnamese));
	}

	/** What GenAI Fund decided about a talent profile. */
	public enum TalentDecision {

		APPROVED, CHANGES_REQUESTED, REMOVED

	}

	/**
	 * Tells an owner that GenAI Fund took their organization down or restored it, in both languages. A reason is read
	 * after signing in.
	 * @param takenDown whether the organization was taken down; otherwise it is back
	 */
	public void sendOrganizationSuspension(String recipient, String organizationName, boolean takenDown) {
		String english = takenDown
				? organizationName + " was taken down on BeyondPilot. Sign in to read why."
				: organizationName + " is back on BeyondPilot. Sign in to manage it.";
		String vietnamese = takenDown
				? organizationName + " đã bị gỡ khỏi BeyondPilot. Hãy đăng nhập để xem lý do."
				: organizationName + " đã được khôi phục trên BeyondPilot. Hãy đăng nhập để quản lý.";
		send("organization_suspension", recipient, organizationName + " on BeyondPilot",
				english + "\n\n" + vietnamese + "\n", paragraphs(english, vietnamese));
	}

	/**
	 * Tells a person the answer to their request to get into an organization, in both languages.
	 * @param claim whether they asked to own an organization nobody owned, which GenAI Fund decides; otherwise they
	 * asked its owners to join
	 * @param approved whether they are in now
	 */
	public void sendOrganizationRequestDecision(String recipient, String organizationName, boolean claim,
			boolean approved) {
		String english;
		String vietnamese;
		if (claim) {
			english = approved
					? "GenAI Fund approved your claim: you now own " + organizationName
							+ " on BeyondPilot. Sign in to manage it."
					: "GenAI Fund declined your claim for " + organizationName
							+ " on BeyondPilot. Sign in to read what you can do next.";
			vietnamese = approved
					? "GenAI Fund đã chấp thuận yêu cầu nhận quyền: bạn hiện là chủ sở hữu của " + organizationName
							+ " trên BeyondPilot. Hãy đăng nhập để quản lý."
					: "GenAI Fund đã từ chối yêu cầu nhận quyền " + organizationName
							+ " trên BeyondPilot. Hãy đăng nhập để xem bạn có thể làm gì tiếp.";
		}
		else {
			english = approved
					? "An owner of " + organizationName + " let you in on BeyondPilot. Sign in to see your organization."
					: "An owner of " + organizationName
							+ " declined your request to join on BeyondPilot. Sign in to read what you can do next.";
			vietnamese = approved
					? "Một chủ sở hữu của " + organizationName
							+ " đã cho bạn tham gia trên BeyondPilot. Hãy đăng nhập để xem tổ chức của bạn."
					: "Một chủ sở hữu của " + organizationName
							+ " đã từ chối yêu cầu tham gia của bạn trên BeyondPilot. Hãy đăng nhập để xem bạn có thể làm gì tiếp.";
		}
		send("organization_request_decision", recipient, "Your request for " + organizationName + " on BeyondPilot",
				english + "\n\n" + vietnamese + "\n", paragraphs(english, vietnamese));
	}

	/**
	 * Tells a person what GenAI Fund decided about their talent profile, in both languages. The reason is read after
	 * signing in; the operator's note, when there is one, is quoted as written.
	 * @param profileName the profile, as it names its person
	 * @param note what the operator wrote to the person; null when nothing
	 */
	public void sendTalentDecision(String recipient, String profileName, TalentDecision decision,
			@Nullable String note) {
		String english = switch (decision) {
			case APPROVED -> "Your talent profile " + profileName + " is approved on BeyondPilot and shows in the"
					+ " directory unless you hid it.";
			case CHANGES_REQUESTED -> "GenAI Fund asks for changes to your talent profile " + profileName
					+ " on BeyondPilot. Sign in to read why, correct it and send it again.";
			case REMOVED -> "GenAI Fund removed your talent profile " + profileName + " from BeyondPilot's directory."
					+ " Sign in to read why; you can correct it and send it again.";
		};
		String vietnamese = switch (decision) {
			case APPROVED -> "Hồ sơ nhân lực " + profileName + " của bạn đã được duyệt trên BeyondPilot và hiện trong"
					+ " danh mục, trừ khi bạn ẩn nó.";
			case CHANGES_REQUESTED -> "GenAI Fund đề nghị bạn sửa hồ sơ nhân lực " + profileName
					+ " trên BeyondPilot. Hãy đăng nhập để xem lý do, chỉnh sửa và gửi lại.";
			case REMOVED -> "GenAI Fund đã gỡ hồ sơ nhân lực " + profileName + " khỏi danh mục của BeyondPilot."
					+ " Hãy đăng nhập để xem lý do; bạn có thể chỉnh sửa và gửi lại.";
		};
		String subject = switch (decision) {
			case APPROVED -> "Your BeyondPilot talent profile is approved";
			case CHANGES_REQUESTED -> "Changes asked for your BeyondPilot talent profile";
			case REMOVED -> "Your BeyondPilot talent profile was removed";
		};
		if (note == null) {
			send("talent_decision", recipient, subject, english + "\n\n" + vietnamese + "\n",
					paragraphs(english, vietnamese));
		}
		else {
			send("talent_decision", recipient, subject, english + "\n\n" + vietnamese + "\n\n" + note + "\n",
					paragraphs(english, vietnamese, note));
		}
	}

	/**
	 * Tells a person with a talent profile that someone wrote to them. The sender's address is not in it: the person
	 * signs in and answers under their talent profile, and only an acceptance shares the two addresses.
	 * @param senderName who wrote, by the name they gave; null when they gave none, never their address
	 * @param senderOrganization the organization the sender belongs to; null when none
	 * @param topic what the message is about: {@code project}, {@code role} or {@code other}
	 * @param message what the sender wrote
	 */
	public void sendTalentEnquiry(String recipient, @Nullable String senderName, @Nullable String senderOrganization,
			String topic, String message) {
		String name = senderName != null ? senderName : "Someone";
		String nameVi = senderName != null ? senderName : "Một người";
		String english = (senderOrganization != null ? name + " (" + senderOrganization + ")" : name) + " wrote to you through your BeyondPilot talent profile, " + switch (topic) {
			case "project" -> "about a project";
			case "role" -> "about a role";
			default -> "about something else";
		} + ". Sign in and open your talent profile > Enquiries to accept or decline. Your address is shared only if"
				+ " you accept.";
		String vietnamese = (senderOrganization != null ? nameVi + " (" + senderOrganization + ")" : nameVi)
				+ " đã viết cho bạn qua hồ sơ nhân lực trên BeyondPilot, " + switch (topic) {
			case "project" -> "về một dự án";
			case "role" -> "về một vị trí công việc";
			default -> "về một việc khác";
		} + ". Hãy đăng nhập và mở Hồ sơ nhân lực > Lời nhắn để chấp nhận hoặc từ chối. Địa chỉ email của bạn chỉ"
				+ " được chia sẻ khi bạn chấp nhận.";
		send("talent_enquiry", recipient, "A message through your BeyondPilot talent profile",
				english + "\n\n" + vietnamese + "\n\n" + message + "\n", paragraphs(english, vietnamese, message));
	}

	/**
	 * Reminds a person that a message waits for their answer and when it closes.
	 * @param senderName who wrote, by the name they gave; null when they gave none, never their address
	 * @param daysLeft the whole days before the message closes unanswered
	 */
	public void sendTalentEnquiryReminder(String recipient, @Nullable String senderName, long daysLeft) {
		String english = (senderName != null ? "A message from " + senderName : "A message") + " waits for your answer on BeyondPilot. It closes in "
				+ daysLeft + " days if you do not answer. Sign in and open your talent profile > Enquiries.";
		String vietnamese = (senderName != null ? "Lời nhắn của " + senderName : "Một lời nhắn") + " đang chờ bạn trả lời trên BeyondPilot. Lời nhắn sẽ tự đóng"
				+ " sau " + daysLeft + " ngày nếu bạn không trả lời. Hãy đăng nhập và mở Hồ sơ nhân lực > Lời nhắn.";
		send("talent_enquiry_reminder", recipient, "A message waits for your answer on BeyondPilot",
				english + "\n\n" + vietnamese + "\n", paragraphs(english, vietnamese));
	}

	/**
	 * Introduces the two sides of a message the person accepted: each is told who the other is and where to write.
	 * @param otherName who the recipient is introduced to, as they are shown
	 * @param otherEmail where the recipient writes to them
	 * @param otherOrganization the organization the other person belongs to; null when none or not known
	 */
	public void sendTalentIntroduction(String recipient, String otherName, String otherEmail,
			@Nullable String otherOrganization) {
		String who = otherName + " (" + otherEmail + ")"
				+ (otherOrganization != null ? " at " + otherOrganization : "");
		String whoVi = otherName + " (" + otherEmail + ")"
				+ (otherOrganization != null ? " tại " + otherOrganization : "");
		String english = "The message through BeyondPilot was accepted. You can now write to " + who
				+ " at this address.";
		String vietnamese = "Lời nhắn qua BeyondPilot đã được chấp nhận. Giờ bạn có thể viết cho " + whoVi
				+ " qua địa chỉ này.";
		send("talent_introduction", recipient, "Your BeyondPilot introduction to " + otherName,
				english + "\n\n" + vietnamese + "\n", paragraphs(english, vietnamese));
	}

	/**
	 * Tells the sender that the person will not take their message further. A report reads the same, so the person who
	 * reported is not exposed. It carries no address and no reason.
	 * @param talentName the person written to, as their profile names them
	 */
	public void sendTalentEnquiryDeclined(String recipient, String talentName) {
		String english = talentName + " will not take your message on BeyondPilot further. You can look for other"
				+ " people in the talent directory.";
		String vietnamese = talentName + " sẽ không tiếp tục lời nhắn của bạn trên BeyondPilot. Bạn có thể tìm người"
				+ " khác trong danh mục nhân lực.";
		send("talent_enquiry_declined", recipient, "Your message to " + talentName,
				english + "\n\n" + vietnamese + "\n", paragraphs(english, vietnamese));
	}

	/**
	 * Tells the sender that their message closed because the person did not answer in time. They may write again.
	 * @param talentName the person written to, as their profile names them
	 */
	public void sendTalentEnquiryClosed(String recipient, String talentName) {
		String english = talentName + " did not answer your message on BeyondPilot in time, so it closed. You can"
				+ " write again from their profile.";
		String vietnamese = talentName + " chưa trả lời lời nhắn của bạn trên BeyondPilot đúng hạn nên lời nhắn đã"
				+ " đóng. Bạn có thể viết lại từ hồ sơ của họ.";
		send("talent_enquiry_closed", recipient, "Your message to " + talentName + " closed",
				english + "\n\n" + vietnamese + "\n", paragraphs(english, vietnamese));
	}

	/**
	 * Tells an owner of a provider that someone asked for an introduction. The sender's address is not in it: the owner
	 * signs in and answers, and only then do both sides learn each other's address.
	 * @param senderName who asks; null until they gave a name
	 * @param senderOrganization the organization they ask as
	 * @param solutionName what they asked about
	 * @param message what the sender needs
	 */
	public void sendIntroductionRequest(String recipient, @Nullable String senderName, String senderOrganization,
			String solutionName, String message) {
		String english = (senderName != null ? senderName : "Someone") + " at " + senderOrganization
				+ " asked GenAI Fund for an introduction to your solution " + solutionName
				+ " on BeyondPilot. Sign in and open My organization > Introductions to answer.";
		String vietnamese = (senderName != null ? senderName : "Một người") + " tại " + senderOrganization
				+ " đã nhờ GenAI Fund giới thiệu tới giải pháp " + solutionName
				+ " của bạn trên BeyondPilot. Hãy đăng nhập và mở Tổ chức của tôi > Giới thiệu để trả lời.";
		send("introduction_request", recipient, "A request for an introduction to " + solutionName,
				english + "\n\n" + vietnamese + "\n\n" + message + "\n", paragraphs(english, vietnamese, message));
	}

	/**
	 * Introduces two people once the provider answered: each is told who the other is and where to write.
	 * @param otherName who the recipient is introduced to; null until they gave a name
	 * @param otherEmail where the recipient writes to them
	 * @param otherOrganization the organization the other person acts for
	 * @param solutionName the solution the introduction is about
	 */
	public void sendIntroduction(String recipient, @Nullable String otherName, String otherEmail,
			String otherOrganization, String solutionName) {
		String who = otherName != null ? otherName + " (" + otherEmail + ")" : otherEmail;
		String english = "GenAI Fund introduces you to " + who + " at " + otherOrganization + ", about the solution "
				+ solutionName + " on BeyondPilot. You can write to each other at these addresses.";
		String vietnamese = "GenAI Fund giới thiệu bạn với " + who + " tại " + otherOrganization + ", về giải pháp "
				+ solutionName + " trên BeyondPilot. Hai bên có thể viết cho nhau qua các địa chỉ này.";
		send("introduction", recipient, "Your introduction about " + solutionName,
				english + "\n\n" + vietnamese + "\n", paragraphs(english, vietnamese));
	}

	/**
	 * Tells the sender that the provider will not take their request further. It carries no address and no reason.
	 */
	public void sendIntroductionDeclined(String recipient, String providerName, String solutionName) {
		String english = providerName + " will not take your request for an introduction about " + solutionName
				+ " further. You can look for another solution on BeyondPilot.";
		String vietnamese = providerName + " sẽ không tiếp tục yêu cầu giới thiệu của bạn về giải pháp "
				+ solutionName + ". Bạn có thể tìm giải pháp khác trên BeyondPilot.";
		send("introduction_declined", recipient, "Your request about " + solutionName,
				english + "\n\n" + vietnamese + "\n", paragraphs(english, vietnamese));
	}

	/**
	 * Confirms to an applicant that their application reached the program, in both languages.
	 * @param version which submission this is: 1 for the first, more when it was submitted again
	 * @param editableUntil until when the application can still change; null when it cannot
	 */
	public void sendApplicationReceived(String recipient, String programName, int version,
			@Nullable Instant editableUntil) {
		String until = editableUntil == null ? null
				: DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale.ENGLISH)
					.withZone(VIETNAM)
					.format(editableUntil) + " ICT";
		String english = (version == 1 ? "Your application to " + programName + " was submitted."
				: "Your changed application to " + programName + " was submitted.")
				+ (until == null ? "" : " You can change it on BeyondPilot until " + until + ".")
				+ " Sign in and open My applications to see where it stands.";
		String vietnamese = (version == 1 ? "Đơn của bạn gửi " + programName + " đã được nộp."
				: "Đơn đã chỉnh sửa của bạn gửi " + programName + " đã được nộp.")
				+ (until == null ? "" : " Bạn có thể sửa đơn trên BeyondPilot tới " + until + ".")
				+ " Hãy đăng nhập và mở Đơn của tôi để xem tình trạng.";
		send("application_received", recipient, "Application submitted: " + programName,
				english + "\n\n" + vietnamese + "\n", paragraphs(english, vietnamese));
	}

	/**
	 * Tells an address that it was asked to judge a program's applications, in both languages. Like an organization
	 * invitation it carries no link that acts: the person signs in with this address and finds the program under
	 * Reviews.
	 * @param inviterName who asked, as they are shown
	 * @param expiresAt when the invitation lapses if nobody signs in with the address
	 */
	public void sendReviewerInvitation(String recipient, String programName, String inviterName, Instant expiresAt) {
		String until = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH).withZone(VIETNAM).format(expiresAt);
		String english = inviterName + " invited you to judge the applications to " + programName
				+ " on BeyondPilot. Sign in with this email address by " + until
				+ " and open Reviews. Your scores and notes are read only by you and GenAI Fund.";
		String vietnamese = inviterName + " mời bạn chấm các đơn nộp vào " + programName
				+ " trên BeyondPilot. Hãy đăng nhập bằng địa chỉ email này trước " + until
				+ " và mở mục Reviews. Điểm và ghi chú của bạn chỉ bạn và GenAI Fund đọc được.";
		send("reviewer_invitation", recipient, "Judge the applications to " + programName,
				english + "\n\n" + vietnamese + "\n", paragraphs(english, vietnamese));
	}

	/**
	 * Sends an applicant the outcome of their application, as the operator wrote it for the applicant's group. The
	 * message is plain text; its paragraphs are kept.
	 */
	public void sendApplicationOutcome(String recipient, String subject, String message) {
		send("application_outcome", recipient, subject, message.strip() + "\n",
				paragraphs(message.strip().split("\\R\\s*\\R")));
	}

	private static String paragraphs(String... texts) {
		StringBuilder html = new StringBuilder();
		for (String text : texts) {
			html.append("<p>").append(HtmlUtils.htmlEscape(text)).append("</p>");
		}
		return html.toString();
	}

	private void send(String kind, String recipient, String subject, String text, String html) {
		try {
			MimeMessage message = mailSender.createMimeMessage();
			MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
			helper.setFrom(properties.from());
			helper.setTo(recipient);
			helper.setSubject(subject);
			helper.setText(text, html);
			mailSender.send(message);
		}
		catch (MailException | MessagingException exception) {
			LOG.atError()
				.addKeyValue("event", "notification.email.failed")
				.addKeyValue("email_kind", kind)
				.addKeyValue("error_type", exception.getClass().getName())
				.addKeyValue("error_code", NotificationErrorCode.EMAIL_NOT_SENT.code())
				.log("Email not sent");
			throw new NotificationException(NotificationErrorCode.EMAIL_NOT_SENT, "Sending the " + kind + " email failed",
					exception);
		}
		LOG.atInfo().addKeyValue("event", "notification.email.sent").addKeyValue("email_kind", kind).log("Email sent");
	}

	private record SignInCodeEmail(String subject, String text, String html) {

		static SignInCodeEmail of(String code, Duration validFor, Locale locale) {
			long minutes = Math.max(1, validFor.toMinutes());
			String shown = HtmlUtils.htmlEscape(code);
			if ("vi".equals(locale.getLanguage())) {
				return new SignInCodeEmail(code + " là mã đăng nhập BeyondPilot của bạn",
						"Mã đăng nhập BeyondPilot của bạn:\n\n" + code
								+ "\n\nNhập mã này vào màn hình đang chờ. Mã có hiệu lực trong " + minutes
								+ " phút. Đừng chia sẻ mã với ai; nếu bạn không yêu cầu, hãy bỏ qua email này.\n",
						"<p>Mã đăng nhập BeyondPilot của bạn:</p><p><strong>" + shown
								+ "</strong></p><p>Nhập mã này vào màn hình đang chờ. Mã có hiệu lực trong " + minutes
								+ " phút. Đừng chia sẻ mã với ai; nếu bạn không yêu cầu, hãy bỏ qua email này.</p>");
			}
			return new SignInCodeEmail(code + " is your BeyondPilot sign-in code",
					"Your BeyondPilot sign-in code:\n\n" + code
							+ "\n\nType it into the screen that is waiting for it. It works for " + minutes
							+ " minutes. Do not share it with anyone; if you did not ask for it, ignore this email.\n",
					"<p>Your BeyondPilot sign-in code:</p><p><strong>" + shown
							+ "</strong></p><p>Type it into the screen that is waiting for it. It works for " + minutes
							+ " minutes. Do not share it with anyone; if you did not ask for it, ignore this email.</p>");
		}
	}
}
