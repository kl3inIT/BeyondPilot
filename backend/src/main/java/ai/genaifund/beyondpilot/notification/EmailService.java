package ai.genaifund.beyondpilot.notification;

import java.time.Duration;
import java.util.Locale;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

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
