package ai.genaifund.beyondpilot.notification.adapter;

import java.io.UnsupportedEncodingException;
import java.util.Properties;

import jakarta.mail.MessagingException;
import jakarta.mail.SendFailedException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

import org.jspecify.annotations.Nullable;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

/**
 * Delivers through any SMTP server with Spring's {@link JavaMailSenderImpl}, built from the connection in the
 * settings. SMTP reports nothing after the server takes a message, so the message identifier is BeyondPilot's own.
 */
@Component
class SmtpEmailAdapter implements EmailAdapter {

	private static final String TIMEOUT_MILLIS = "10000";

	private record Sender(EmailConnection.SmtpConnection connection, JavaMailSenderImpl mailSender) {
	}

	private volatile @Nullable Sender sender;

	@Override
	public EmailProvider provider() {
		return EmailProvider.SMTP;
	}

	@Override
	public EmailProviderCapabilities capabilities() {
		return new EmailProviderCapabilities(false);
	}

	/** An SMTP server has no API to ask; the test email is the check. */
	@Override
	public EmailSetup inspect(EmailConnection connection, String domain) {
		return EmailSetup.nothingToAsk();
	}

	@Override
	public EmailResult send(EmailRequest request, EmailConnection connection) {
		JavaMailSenderImpl mailSender = mailSender((EmailConnection.SmtpConnection) connection);
		String messageId = "<" + request.messageId() + "@beyondpilot>";
		try {
			MimeMessage message = new MimeMessage(mailSender.getSession()) {

				@Override
				protected void updateMessageID() throws MessagingException {
					setHeader("Message-ID", messageId);
				}

			};
			MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
			helper.setFrom(new InternetAddress(request.fromAddress(), request.fromName(), "UTF-8"));
			if (request.replyTo() != null) {
				helper.setReplyTo(request.replyTo());
			}
			helper.setTo(request.to());
			helper.setSubject(request.subject());
			helper.setText(request.text(), request.html());
			mailSender.send(message);
		}
		catch (MailAuthenticationException exception) {
			throw new EmailDeliveryException(EmailDeliveryException.DeliveryFailure.AUTHENTICATION,
					"The SMTP server refused the credentials", exception);
		}
		catch (MailSendException exception) {
			boolean recipientRefused = exception.getFailedMessages()
				.values()
				.stream()
				.anyMatch(failure -> failure instanceof SendFailedException refused
						&& refused.getInvalidAddresses() != null && refused.getInvalidAddresses().length > 0);
			throw new EmailDeliveryException(recipientRefused ? EmailDeliveryException.DeliveryFailure.INVALID_RECIPIENT
					: EmailDeliveryException.DeliveryFailure.UNAVAILABLE, "The SMTP server did not take the message",
					exception);
		}
		catch (MailException | MessagingException | UnsupportedEncodingException exception) {
			throw new EmailDeliveryException(EmailDeliveryException.DeliveryFailure.UNAVAILABLE,
					"The message could not be handed to the SMTP server", exception);
		}
		return new EmailResult(messageId);
	}

	private JavaMailSenderImpl mailSender(EmailConnection.SmtpConnection connection) {
		Sender current = sender;
		if (current != null && current.connection().equals(connection)) {
			return current.mailSender();
		}
		JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
		mailSender.setHost(connection.host());
		mailSender.setPort(connection.port());
		mailSender.setDefaultEncoding("UTF-8");
		Properties properties = mailSender.getJavaMailProperties();
		boolean tls = connection.security() == EmailConnection.SmtpSecurity.TLS;
		String prefix = tls ? "mail.smtps." : "mail.smtp.";
		mailSender.setProtocol(tls ? "smtps" : "smtp");
		if (connection.username() != null) {
			mailSender.setUsername(connection.username());
			mailSender.setPassword(connection.password());
			properties.put(prefix + "auth", "true");
		}
		if (connection.security() == EmailConnection.SmtpSecurity.STARTTLS) {
			properties.put("mail.smtp.starttls.enable", "true");
			properties.put("mail.smtp.starttls.required", "true");
		}
		if (connection.security() != EmailConnection.SmtpSecurity.NONE) {
			properties.put(prefix + "ssl.checkserveridentity", "true");
		}
		properties.put(prefix + "connectiontimeout", TIMEOUT_MILLIS);
		properties.put(prefix + "timeout", TIMEOUT_MILLIS);
		properties.put(prefix + "writetimeout", TIMEOUT_MILLIS);
		sender = new Sender(connection, mailSender);
		return mailSender;
	}

}
