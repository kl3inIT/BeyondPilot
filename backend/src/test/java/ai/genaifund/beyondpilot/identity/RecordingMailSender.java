package ai.genaifund.beyondpilot.identity;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.MimeMessage;

import org.jspecify.annotations.Nullable;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/** Stands in for the SMTP server, the one external collaborator of sign-in: it keeps what would have been sent. */
class RecordingMailSender extends JavaMailSenderImpl {

	private static final Pattern LINK = Pattern.compile("https?://\\S+");

	private final List<MimeMessage> sent = new CopyOnWriteArrayList<>();

	@Override
	protected void doSend(MimeMessage[] messages, Object @Nullable [] originals) {
		sent.addAll(List.of(messages));
	}

	/** The link in the plain-text part of the newest email sent to the address. */
	String latestLinkTo(String recipient) {
		for (MimeMessage message : sent.reversed()) {
			try {
				if (message.getRecipients(Message.RecipientType.TO)[0].toString().equals(recipient)) {
					Matcher link = LINK.matcher(plainText(message));
					if (link.find()) {
						return link.group();
					}
				}
			}
			catch (MessagingException | IOException exception) {
				throw new IllegalStateException(exception);
			}
		}
		throw new AssertionError("No email with a link was sent to " + recipient);
	}

	String latestSubjectTo(String recipient) {
		for (MimeMessage message : sent.reversed()) {
			try {
				if (message.getRecipients(Message.RecipientType.TO)[0].toString().equals(recipient)) {
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
				return message.getRecipients(Message.RecipientType.TO)[0].toString().equals(recipient);
			}
			catch (MessagingException exception) {
				throw new IllegalStateException(exception);
			}
		}).count();
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

	/** The query parameters of a link, undecoded. */
	static Map<String, String> query(String link) {
		String query = link.substring(link.indexOf('?') + 1);
		return Arrays.stream(query.split("&"))
			.map(pair -> pair.split("=", 2))
			.collect(Collectors.toMap(pair -> pair[0], pair -> pair[1]));
	}
}
