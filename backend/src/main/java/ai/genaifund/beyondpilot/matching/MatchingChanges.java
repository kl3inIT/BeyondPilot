package ai.genaifund.beyondpilot.matching;

import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;

import ai.genaifund.beyondpilot.matching.dto.MatchingChange;
import ai.genaifund.beyondpilot.matching.dto.MatchingChange.Kind;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import reactor.core.publisher.BufferOverflowStrategy;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

/**
 * What changes in matching, told to the pages that are open on a use case. A change says that something is different
 * and of what kind; it carries no state, because the page reads the state again and every change is in the database
 * when it is told. Nothing is kept for a page that was not listening: a page that comes back reads the state once.
 * The changes stay inside this instance of the application (docs/increments/active/bey-39-matching/live.md).
 */
@Component
class MatchingChanges {

	/** How many changes wait for a page that reads slowly; past that the oldest are dropped, since each only says "read again". */
	private static final int WAITING = 256;

	private record Told(UUID useCaseId, MatchingChange change) {
	}

	/** Nobody listening is not a failure, and a listener that cannot take a change loses it and nothing else. */
	private final Sinks.Many<Told> sink = Sinks.many().multicast().directBestEffort();

	/** A sink refuses two threads at once, and the judgments of a run end on several. */
	private final ReentrantLock telling = new ReentrantLock();

	/**
	 * Tells that something changed for a use case. Inside a transaction it is told once the transaction is committed,
	 * so that a page reading at once reads the change; a transaction that is rolled back tells nothing.
	 * @param solutionId the solution a judgment starts or ended for; null for every other kind
	 */
	void tell(UUID useCaseId, Kind kind, @Nullable UUID solutionId) {
		Told told = new Told(useCaseId, new MatchingChange(kind, solutionId));
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

	void tell(UUID useCaseId, Kind kind) {
		tell(useCaseId, kind, null);
	}

	private void emit(Told told) {
		telling.lock();
		try {
			// The result is not read: with nobody listening there is nothing to do, and no listener can fail a run.
			sink.tryEmitNext(told);
		}
		finally {
			telling.unlock();
		}
	}

	/**
	 * The changes of one use case from now on. Each listener has a buffer of its own, so one that reads slowly, or is
	 * gone, never holds back the one that tells.
	 */
	Flux<MatchingChange> of(UUID useCaseId) {
		return sink.asFlux()
			.filter(told -> told.useCaseId().equals(useCaseId))
			.map(Told::change)
			.onBackpressureBuffer(WAITING, BufferOverflowStrategy.DROP_OLDEST);
	}

}
