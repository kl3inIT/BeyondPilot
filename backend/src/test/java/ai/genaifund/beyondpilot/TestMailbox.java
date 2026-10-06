package ai.genaifund.beyondpilot;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.MimeMessage;

import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetupTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * A real SMTP server for tests, which the email settings point at: what the application sends goes through the queue,
 * the registry of providers and the SMTP adapter, and arrives here. Email leaves after the change that sends it
 * commits, so every read first waits, for a bounded time, until nothing is left in the queue.
 */
public class TestMailbox {

	/** The code stands alone on its line in the plain-text part. */
	private static final Pattern CODE = Pattern.compile("(?m)^\\d{6}$");

	private static final Duration SETTLE = Duration.ofSeconds(15);

	private final GreenMail server;

	private final JdbcClient jdbc;

	TestMailbox(GreenMail server, JdbcClient jdbc) {
		this.server = server;
		this.jdbc = jdbc;
	}

	/** The six-digit code in the newest email sent to the address. */
	public String latestCodeTo(String recipient) {
		for (MimeMessage message : to(recipient).reversed()) {
			Matcher code = CODE.matcher(plainText(message));
			if (code.find()) {
				return code.group();
			}
		}
		throw new AssertionError("No email with a code was sent to " + recipient);
	}

	public String latestSubjectTo(String recipient) {
		try {
			return latestTo(recipient).getSubject();
		}
		catch (MessagingException exception) {
			throw new IllegalStateException(exception);
		}
	}

	/** The plain-text part of the newest email sent to the address. */
	public String latestTextTo(String recipient) {
		return plainText(latestTo(recipient));
	}

	public long countTo(String recipient) {
		return to(recipient).size();
	}

	private MimeMessage latestTo(String recipient) {
		List<MimeMessage> messages = to(recipient);
		if (messages.isEmpty()) {
			throw new AssertionError("No email was sent to " + recipient);
		}
		return messages.getLast();
	}

	private List<MimeMessage> to(String recipient) {
		settle();
		return List.of(server.getReceivedMessages()).stream().filter(message -> {
			try {
				return message.getRecipients(Message.RecipientType.TO)[0].toString().equals(recipient);
			}
			catch (MessagingException exception) {
				throw new IllegalStateException(exception);
			}
		}).toList();
	}

	/** Waits until the queue holds nothing to send, so every email the test caused has arrived or failed. */
	private void settle() {
		Instant deadline = Instant.now().plus(SETTLE);
		while (jdbc.sql("select count(*) from email_message where status = 'queued'").query(Long.class).single() > 0) {
			if (Instant.now().isAfter(deadline)) {
				throw new AssertionError("Email was still queued after " + SETTLE);
			}
			try {
				Thread.sleep(50);
			}
			catch (InterruptedException exception) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException(exception);
			}
		}
	}

	private static String plainText(Part part) {
		try {
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
		catch (MessagingException | IOException exception) {
			throw new IllegalStateException(exception);
		}
	}

	/** Starts the server and points the email settings at it once Flyway has made the table. */
	@TestConfiguration(proxyBeanMethods = false)
	public static class Configuration {

		@Bean(destroyMethod = "stop")
		GreenMail testSmtpServer() {
			GreenMail server = new GreenMail(ServerSetupTest.SMTP.dynamicPort());
			server.start();
			return server;
		}

		@Bean
		@DependsOn("flywayInitializer")
		TestMailbox testMailbox(GreenMail testSmtpServer, JdbcClient jdbc) {
			jdbc.sql("""
					update email_settings
					set provider = 'smtp', from_name = 'BeyondPilot', from_address = 'no-reply@beyondpilot.test',
					    smtp_host = '127.0.0.1', smtp_port = :port, smtp_security = 'none'
					where id = 1
					""").param("port", testSmtpServer.getSmtp().getPort()).update();
			return new TestMailbox(testSmtpServer, jdbc);
		}

	}

}
