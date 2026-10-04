package ai.genaifund.beyondpilot.notification;

import java.net.URI;
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
	 * Sends the link that signs its recipient in.
	 * @param recipient the address the link is sent to
	 * @param link the single-use link
	 * @param validFor how long the link works
	 * @param locale the language of the email; Vietnamese for {@code vi}, English otherwise
	 */
	public void sendSignInLink(String recipient, URI link, Duration validFor, Locale locale) {
		SignInLinkEmail email = SignInLinkEmail.of(link, validFor, locale);
		send("sign_in_link", recipient, email.subject(), email.text(), email.html());
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

	private record SignInLinkEmail(String subject, String text, String html) {

		static SignInLinkEmail of(URI link, Duration validFor, Locale locale) {
			long minutes = Math.max(1, validFor.toMinutes());
			String href = HtmlUtils.htmlEscape(link.toString());
			if ("vi".equals(locale.getLanguage())) {
				return new SignInLinkEmail("Link đăng nhập BeyondPilot của bạn",
						"Mở link này để đăng nhập BeyondPilot:\n\n" + link + "\n\nLink có hiệu lực trong " + minutes
								+ " phút và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.\n",
						"<p>Mở link này để đăng nhập BeyondPilot:</p><p><a href=\"" + href
								+ "\">Đăng nhập BeyondPilot</a></p><p>Link có hiệu lực trong " + minutes
								+ " phút và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>");
			}
			return new SignInLinkEmail("Your BeyondPilot sign-in link",
					"Open this link to sign in to BeyondPilot:\n\n" + link + "\n\nThe link works for " + minutes
							+ " minutes and only once. If you did not ask for it, ignore this email.\n",
					"<p>Open this link to sign in to BeyondPilot:</p><p><a href=\"" + href
							+ "\">Sign in to BeyondPilot</a></p><p>The link works for " + minutes
							+ " minutes and only once. If you did not ask for it, ignore this email.</p>");
		}
	}
}
