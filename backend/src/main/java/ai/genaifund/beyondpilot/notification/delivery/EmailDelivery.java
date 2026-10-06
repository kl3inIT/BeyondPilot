package ai.genaifund.beyondpilot.notification.delivery;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import ai.genaifund.beyondpilot.notification.adapter.EmailAdapterRegistry;
import ai.genaifund.beyondpilot.notification.adapter.EmailDeliveryException;
import ai.genaifund.beyondpilot.notification.adapter.EmailDeliveryException.DeliveryFailure;
import ai.genaifund.beyondpilot.notification.adapter.EmailRequest;
import ai.genaifund.beyondpilot.notification.adapter.EmailResult;
import ai.genaifund.beyondpilot.notification.persistence.EmailMessageRepository;
import ai.genaifund.beyondpilot.notification.persistence.EmailMessageRepository.Claimed;
import ai.genaifund.beyondpilot.notification.settings.DeliverySettings;
import ai.genaifund.beyondpilot.notification.template.RenderedEmail;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;

/**
 * Hands queued email to the configured provider. A message is sent right after the transaction that queued it commits;
 * one the provider could not take waits and is tried again by the sweep, later each time, until a day has passed.
 * Nothing here runs in a transaction: each step commits on its own, so no database connection waits on a provider.
 */
@Component
@EnableScheduling
public class EmailDelivery {

	private static final Logger LOG = LoggerFactory.getLogger(EmailDelivery.class);

	/** How long a sender holds a message it took before another may take it. */
	static final Duration LEASE = Duration.ofMinutes(5);

	/** How long BeyondPilot keeps trying a message. */
	static final Duration EXPIRY = Duration.ofHours(24);

	/** How long a message and its events are kept for operators to read. */
	static final Duration RETENTION = Duration.ofDays(90);

	private static final int SWEEP_LIMIT = 100;

	private final EmailMessageRepository messages;

	private final DeliverySettings settings;

	private final EmailAdapterRegistry adapters;

	EmailDelivery(EmailMessageRepository messages, DeliverySettings settings, EmailAdapterRegistry adapters) {
		this.messages = messages;
		this.settings = settings;
		this.adapters = adapters;
	}

	@ApplicationModuleListener(propagation = Propagation.NOT_SUPPORTED)
	void on(EmailQueued queued) {
		messages.claim(queued.messageId(), LEASE).ifPresent(message -> attempt(message, true));
	}

	@Scheduled(initialDelayString = "PT30S", fixedDelayString = "PT1M")
	void sweep() {
		int expired = messages.expire(Instant.now().minus(EXPIRY), DeliveryFailure.EXPIRED.value());
		if (expired > 0) {
			LOG.atWarn()
				.addKeyValue("event", "notification.email.expired")
				.addKeyValue("count", expired)
				.log("Emails were given up after a day of attempts");
		}
		for (Claimed message : messages.claimDue(SWEEP_LIMIT, LEASE)) {
			attempt(message, true);
		}
	}

	@Scheduled(cron = "0 15 3 * * *", zone = "Asia/Ho_Chi_Minh")
	void purge() {
		int purged = messages.purge(Instant.now().minus(RETENTION));
		LOG.atInfo().addKeyValue("event", "notification.email.purged").addKeyValue("count", purged).log("Old emails deleted");
	}

	/**
	 * Sends a message that was just queued, in the caller's thread, and does not try it again: a sign-in code is useful
	 * only while its screen waits.
	 * @param content what is sent, which may differ from what the log keeps: a code is logged masked
	 * @return why it was not sent; empty when it was
	 */
	public Optional<DeliveryFailure> sendNow(UUID messageId, RenderedEmail content) {
		return messages.claim(messageId, LEASE)
			.map(logged -> attempt(new Claimed(logged.id(), logged.kind(), logged.recipient(), content.subject(),
					content.html(), content.text(), logged.attempts()), false))
			.orElse(Optional.of(DeliveryFailure.UNAVAILABLE));
	}

	private Optional<DeliveryFailure> attempt(Claimed message, boolean retry) {
		Optional<DeliverySettings.Delivery> delivery = settings.delivery();
		if (delivery.isEmpty()) {
			return failed(message, DeliveryFailure.NOT_CONFIGURED, null, retry);
		}
		DeliverySettings.Delivery to = delivery.get();
		EmailRequest request = new EmailRequest(message.id(), to.fromName(), to.fromAddress(), to.replyTo(),
				message.recipient(), message.subject(), message.html(), message.text(), message.kind());
		try {
			EmailResult result = adapters.adapter(to.provider()).send(request, to.connection());
			messages.markSent(message.id(), to.provider().value(), result.providerMessageId());
			LOG.atInfo()
				.addKeyValue("event", "notification.email.sent")
				.addKeyValue("email_id", message.id())
				.addKeyValue("email_kind", message.kind())
				.addKeyValue("provider", to.provider().value())
				.log("Email sent");
			return Optional.empty();
		}
		catch (EmailDeliveryException exception) {
			return failed(message, exception.failure(), exception, retry);
		}
		catch (RuntimeException exception) {
			return failed(message, DeliveryFailure.UNAVAILABLE, exception, retry);
		}
	}

	private Optional<DeliveryFailure> failed(Claimed message, DeliveryFailure failure, @Nullable Exception exception,
			boolean retry) {
		boolean again = retry && failure.temporary();
		if (again) {
			messages.markRetry(message.id(), Instant.now().plus(backoff(message.attempts())), failure.value());
		}
		else {
			messages.markFailed(message.id(), failure.value());
		}
		var log = again ? LOG.atWarn() : LOG.atError();
		log = log.addKeyValue("event", again ? "notification.email.retrying" : "notification.email.failed")
			.addKeyValue("email_id", message.id())
			.addKeyValue("email_kind", message.kind())
			.addKeyValue("attempts", message.attempts())
			.addKeyValue("error_code", failure.value());
		if (exception != null) {
			log = log.addKeyValue("error_type", exception.getClass().getName());
		}
		log.log(again ? "Email not sent, to be tried again" : "Email not sent");
		return Optional.of(failure);
	}

	/** 1, 5, 15 and 30 minutes after the first four attempts, then every hour. */
	static Duration backoff(int attempts) {
		return switch (attempts) {
			case 1 -> Duration.ofMinutes(1);
			case 2 -> Duration.ofMinutes(5);
			case 3 -> Duration.ofMinutes(15);
			case 4 -> Duration.ofMinutes(30);
			default -> Duration.ofHours(1);
		};
	}

}
