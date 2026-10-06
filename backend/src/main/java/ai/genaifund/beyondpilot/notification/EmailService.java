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

	/**
	 * Passes a message on to a person who has a talent profile. The sender is named with their address so the person
	 * can answer by email; the sender never learns the address this is sent to.
	 * @param senderName who wrote the message, as they are shown
	 * @param senderEmail where the person answers
	 * @param message what the sender wrote
	 */
	public void sendTalentEnquiry(String recipient, String senderName, String senderEmail, String message) {
		String english = senderName + " (" + senderEmail + ") sent you a message through your BeyondPilot talent profile."
				+ " Answer them at that address.";
		String vietnamese = senderName + " (" + senderEmail + ") đã gửi cho bạn một lời nhắn qua hồ sơ nhân tài của bạn"
				+ " trên BeyondPilot. Hãy trả lời họ qua địa chỉ đó.";
		send("talent_enquiry", recipient, "A message through your BeyondPilot talent profile",
				english + "\n\n" + vietnamese + "\n\n" + message + "\n", paragraphs(english, vietnamese, message));
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
