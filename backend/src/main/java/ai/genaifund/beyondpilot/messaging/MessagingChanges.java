package ai.genaifund.beyondpilot.messaging;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Function;

import ai.genaifund.beyondpilot.messaging.dto.MessagingEvent;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import reactor.core.publisher.BufferOverflowStrategy;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

/**
 * What happens in conversations, told to the screens that are open: a message, how far someone read, that someone is
 * writing, and that a conversation started or was answered. An event reaches only the people of its conversation, and
 * each of them gets it as they read it. Nothing is kept for a screen that was not listening: a screen that comes back
 * reads what it missed. The events stay inside this instance of the application, as matching's do
 * (docs/increments/active/bey-39-matching/live.md).
 */
@Component
class MessagingChanges {

	/**
	 * How many events wait for a screen that reads slowly; past that the oldest are dropped, and the screen reads what
	 * it missed when its stream opens again.
	 */
	private static final int WAITING = 256;

	/**
	 * Who an event is for: the people named, everyone of an organization, and GenAI Fund's operators.
	 * @param organizationId the organization written to; null when the conversation has none
	 * @param operators whether the conversation is with GenAI Fund
	 */
	record Audience(Set<UUID> accounts, @Nullable UUID organizationId, boolean operators) {

		boolean includes(Listener listener) {
			return accounts.contains(listener.accountId())
					|| (organizationId != null && organizationId.equals(listener.organizationId()))
					|| (operators && listener.operator());
		}
	}

	/**
	 * A screen that listens, with what its person was when the stream opened.
	 * @param organizationId the organization the person belongs to; null when none
	 * @param operator whether the person answers for GenAI Fund
	 */
	record Listener(UUID accountId, @Nullable UUID organizationId, boolean operator) {
	}

	/**
	 * @param event the event as one listener reads it; null when it is not for them, as that someone is writing is not
	 * for the one who writes
	 */
	private record Told(Audience audience, Function<Listener, @Nullable MessagingEvent> event) {
	}

	/** Nobody listening is not a failure, and a listener that cannot take an event loses it and nothing else. */
	private final Sinks.Many<Told> sink = Sinks.many().multicast().directBestEffort();

	/** A sink refuses two threads at once, and people write at the same moment. */
	private final ReentrantLock telling = new ReentrantLock();

	/** How many screens each person has open. */
	private final Map<UUID, Integer> listening = new ConcurrentHashMap<>();

	/**
	 * Tells the people of a conversation that something happened. Inside a transaction it is told once the transaction
	 * is committed, so that a screen reading at once reads the change; a transaction that is rolled back tells nothing.
	 */
	void tell(Audience audience, Function<Listener, @Nullable MessagingEvent> event) {
		Told told = new Told(audience, event);
		if (TransactionSynchronizationManager.isSynchronizationActive()) {
			TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
				@Override
				public void afterCommit() {
					emit(told);
				}
			});
		}
		else {
			emit(told);
		}
	}

	private void emit(Told told) {
		telling.lock();
		try {
			// The result is not read: with nobody listening there is nothing to do, and no listener can fail a write.
			sink.tryEmitNext(told);
		}
		finally {
			telling.unlock();
		}
	}

	/** Whether a person has a screen open now, on this instance. */
	boolean isListening(UUID accountId) {
		return listening.containsKey(accountId);
	}

	/**
	 * The events of one person's conversations from now on. Each listener has a buffer of its own, so one that reads
	 * slowly, or is gone, never holds back the one that tells.
	 */
	Flux<MessagingEvent> of(Listener listener) {
		return sink.asFlux()
			.filter(told -> told.audience().includes(listener))
			.<MessagingEvent>handle((told, events) -> {
				MessagingEvent event = told.event().apply(listener);
				if (event != null) {
					events.next(event);
				}
			})
			.onBackpressureBuffer(WAITING, BufferOverflowStrategy.DROP_OLDEST)
			.doOnSubscribe(subscription -> listening.merge(listener.accountId(), 1, Integer::sum))
			.doFinally(signal -> listening.computeIfPresent(listener.accountId(),
					(account, screens) -> screens > 1 ? screens - 1 : null));
	}

}
