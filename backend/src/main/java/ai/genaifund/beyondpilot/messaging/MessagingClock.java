package ai.genaifund.beyondpilot.messaging;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.function.Consumer;

import ai.genaifund.beyondpilot.BusinessException;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.messaging.dto.MessagingEvent;
import ai.genaifund.beyondpilot.messaging.dto.MessagingEvent.Kind;
import ai.genaifund.beyondpilot.messaging.persistence.MessagingRepository;
import ai.genaifund.beyondpilot.messaging.persistence.MessagingRepository.Conversation;
import ai.genaifund.beyondpilot.notification.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * What time does to a first message nobody answers: the side written to is reminded once after seven days, and the
 * request closes after fourteen, which the sender is told. Each request is handled in its own transaction, so one
 * email that fails does not hold back the others; it is tried again on the next run.
 *
 * <p>
 * The application runs as one instance. The rows a run handles are locked and checked again, but a second instance
 * could still remind a person twice if both read a request before either marked it.
 */
@Component
@EnableScheduling
class MessagingClock {

	private static final Logger LOG = LoggerFactory.getLogger(MessagingClock.class);

	/** When the side written to is reminded of a request that waits. */
	static final Duration REMINDER_AFTER = Duration.ofDays(7);

	/** How many requests one run handles of each kind; the rest wait for the next run. */
	private static final int BATCH = 100;

	private final MessagingRepository conversations;

	private final MessagingService messaging;

	private final MessagingChanges changes;

	private final IdentityService identity;

	private final EmailService email;

	private final TransactionTemplate transaction;

	MessagingClock(MessagingRepository conversations, MessagingService messaging, MessagingChanges changes,
			IdentityService identity, EmailService email, PlatformTransactionManager transactions) {
		this.conversations = conversations;
		this.messaging = messaging;
		this.changes = changes;
		this.identity = identity;
		this.email = email;
		this.transaction = new TransactionTemplate(transactions);
	}

	@Scheduled(initialDelayString = "PT1M", fixedDelayString = "PT1H")
	void run() {
		Instant now = Instant.now();
		close(now);
		remind(now);
	}

	/** Closes the requests that waited longer than their lifetime and tells each sender. */
	int close(Instant now) {
		int closed = 0;
		for (Conversation due : due(now.minus(MessagingService.REQUEST_LIFETIME), false)) {
			if (handle(due, request -> {
				conversations.answer(request.id(), MessagingRepository.CLOSED, null);
				Person starter = identity.people(List.of(request.starterAccountId())).get(request.starterAccountId());
				if (starter != null) {
					email.sendMessageRequestClosed(starter.email(), messaging.starterReads(request));
				}
				changes.tell(MessagingService.audience(request),
						listener -> new MessagingEvent(Kind.CONVERSATION, request.id(), null, null, null, null, null));
			})) {
				closed++;
			}
		}
		return closed;
	}

	/** Reminds the side written to, once, of a request that waited longer than the reminder delay. */
	int remind(Instant now) {
		int reminded = 0;
		for (Conversation due : due(now.minus(REMINDER_AFTER), true)) {
			if (handle(due, request -> {
				// Read again under the lock: another run may have reminded since the list was read.
				if (request.remindedAt() != null) {
					return;
				}
				conversations.markReminded(request.id());
				Person starter = identity.people(List.of(request.starterAccountId())).get(request.starterAccountId());
				long daysLeft = Math.max(1,
						Duration.between(now, request.createdAt().plus(MessagingService.REQUEST_LIFETIME)).toDays());
				for (Person recipient : messaging.answering(request)) {
					email.sendMessageRequestReminder(recipient.email(), starter == null ? null : starter.displayName(),
							daysLeft);
				}
			})) {
				reminded++;
			}
		}
		return reminded;
	}

	/** The waiting requests that are due, read in a short transaction; each is locked again and checked to handle. */
	private List<Conversation> due(Instant before, boolean unreminded) {
		List<Conversation> found = transaction.execute(status -> unreminded
				? conversations.unremindedBefore(before, BATCH) : conversations.waitingBefore(before, BATCH));
		return found == null ? List.of() : found;
	}

	/** Runs one request's change in its own transaction, after checking it still waits; false when it did not run. */
	private boolean handle(Conversation due, Consumer<Conversation> change) {
		try {
			Boolean done = transaction.execute(status -> conversations.findForUpdate(due.id())
				.filter(now -> MessagingRepository.PENDING.equals(now.status()))
				.map(now -> {
					change.accept(now);
					return true;
				})
				.orElse(false));
			return Boolean.TRUE.equals(done);
		}
		catch (RuntimeException exception) {
			LOG.atWarn()
				.addKeyValue("event", "messaging.request.clock_failed")
				.addKeyValue("conversation_id", due.id())
				.addKeyValue("error_type", exception.getClass().getName())
				.addKeyValue("error_code", exception instanceof BusinessException business ? business.code() : null)
				.log("A waiting first message was not handled; the next run tries again");
			return false;
		}
	}

}
