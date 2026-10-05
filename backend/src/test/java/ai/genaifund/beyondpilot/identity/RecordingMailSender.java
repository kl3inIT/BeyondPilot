package ai.genaifund.beyondpilot.identity;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.MimeMessage;

import org.jspecify.annotations.Nullable;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/** Stands in for the SMTP server, the one external collaborator of sign-in: it keeps what would have been sent. */
public class RecordingMailSender extends JavaMailSenderImpl {

	/** The code stands alone on its line in the plain-text part. */
	private static final Pattern CODE = Pattern.compile("(?m)^\\d{6}$");

	private final List<MimeMessage> sent = new CopyOnWriteArrayList<>();

	@Override
	protected void doSend(MimeMessage[] messages, Object @Nullable [] originals) {
		sent.addAll(List.of(messages));
	}

	/** The six-digit code in the newest email sent to the address. */
	public String latestCodeTo(String recipient) {
		for (MimeMessage message : sent.reversed()) {
			try {
				if (isTo(message, recipient)) {
					Matcher code = CODE.matcher(plainText(message));
					if (code.find()) {
						return code.group();
					}
				}
			}
			catch (MessagingException | IOException exception) {
				throw new IllegalStateException(exception);
			}
		}
		throw new AssertionError("No email with a code was sent to " + recipient);
	}

	public String latestSubjectTo(String recipient) {
		for (MimeMessage message : sent.reversed()) {
			try {
				if (isTo(message, recipient)) {
					return message.getSubject();
				}
			}
			catch (MessagingException exception) {
				throw new IllegalStateException(exception);
			}
		}
		throw new AssertionError("No email was sent to " + recipient);
	}

	long countTo(String recipient) {
		return sent.stream().filter(message -> {
			try {
				return isTo(message, recipient);
			}
			catch (MessagingException exception) {
				throw new IllegalStateException(exception);
			}
		}).count();
	}

	private static boolean isTo(MimeMessage message, String recipient) throws MessagingException {
		return message.getRecipients(Message.RecipientType.TO)[0].toString().equals(recipient);
	}

	private static String plainText(Part part) throws MessagingException, IOException {
		Object content = part.getContent();
		if (content instanceof Multipart multipart) {
			for (int index = 0; index < multipart.getCount(); index++) {
				String text = plainText(multipart.getBodyPart(index));
				if (!text.isEmpty()) {
					return text;
				}
			}
			return "";
		}
		return content instanceof String text && part.isMimeType("text/plain") ? text : "";
	}
}
