package ai.genaifund.beyondpilot.matching;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import ai.genaifund.beyondpilot.matching.dto.MatchingChange;
import ai.genaifund.beyondpilot.matching.dto.MatchingChange.Kind;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.reactivestreams.Subscription;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionSynchronizationUtils;
import reactor.core.Disposable;
import reactor.core.publisher.BaseSubscriber;

/**
 * What a page open on a use case hears of matching. Plain code: the transaction is the synchronization Spring keeps for
 * the thread, opened and committed by the test.
 */
class MatchingChangesTest {

	private final MatchingChanges changes = new MatchingChanges();

	@AfterEach
	void noTransaction() {
		if (TransactionSynchronizationManager.isSynchronizationActive()) {
			TransactionSynchronizationManager.clearSynchronization();
		}
	}

	@Test
	void aStreamHearsTheChangesOfItsUseCaseOnlyInTheOrderTheyWereTold() {
		UUID useCase = UUID.randomUUID();
		UUID other = UUID.randomUUID();
		UUID solution = UUID.randomUUID();
		List<MatchingChange> heard = new CopyOnWriteArrayList<>();
		List<MatchingChange> heardByOther = new CopyOnWriteArrayList<>();
		// Nobody listens yet: the change is not kept for whoever comes later.
		changes.tell(useCase, Kind.RUN);
		Disposable listening = changes.of(useCase).subscribe(heard::add);
		changes.of(other).subscribe(heardByOther::add);

		changes.tell(useCase, Kind.BRIEF);
		changes.tell(other, Kind.DECISION);
		changes.tell(useCase, Kind.READING, solution);
		changes.tell(useCase, Kind.READ, solution);

		assertThat(heard).containsExactly(new MatchingChange(Kind.BRIEF, null), new MatchingChange(Kind.READING, solution),
				new MatchingChange(Kind.READ, solution));
		assertThat(heardByOther).containsExactly(new MatchingChange(Kind.DECISION, null));

		// A page that left hears nothing more, and telling goes on for the others.
		listening.dispose();
		changes.tell(useCase, Kind.RUN);
		changes.tell(other, Kind.RUN);
		assertThat(heard).hasSize(3);
		assertThat(heardByOther).hasSize(2);
	}

	@Test
	void aChangeToldInATransactionIsHeardOnlyAfterTheCommit() {
		UUID useCase = UUID.randomUUID();
		List<Kind> heard = new CopyOnWriteArrayList<>();
		changes.of(useCase).map(MatchingChange::kind).subscribe(heard::add);

		TransactionSynchronizationManager.initSynchronization();
		changes.tell(useCase, Kind.DECISION);
		changes.tell(useCase, Kind.RUN);
		assertThat(heard).isEmpty();
		TransactionSynchronizationUtils.triggerAfterCommit();
		TransactionSynchronizationManager.clearSynchronization();
		assertThat(heard).containsExactly(Kind.DECISION, Kind.RUN);

		// A transaction that is rolled back never commits, so what it told is never heard.
		TransactionSynchronizationManager.initSynchronization();
		changes.tell(useCase, Kind.DECISION);
		TransactionSynchronizationManager.clearSynchronization();
		changes.tell(useCase, Kind.FOUND);
		assertThat(heard).containsExactly(Kind.DECISION, Kind.RUN, Kind.FOUND);
	}

	@Test
	void manyThreadsTellAtOnceAndAListenerThatDoesNotReadHoldsNobodyBack() throws InterruptedException {
		UUID useCase = UUID.randomUUID();
		List<MatchingChange> heard = new CopyOnWriteArrayList<>();
		changes.of(useCase).subscribe(heard::add);
		// A page whose connection takes nothing: it asks for no change at all.
		changes.of(useCase).subscribe(new BaseSubscriber<MatchingChange>() {
			@Override
			protected void hookOnSubscribe(Subscription subscription) {
				// Nothing is asked for.
			}
		});
		int threads = 8;
		int each = 500;
		CountDownLatch together = new CountDownLatch(1);
		try (ExecutorService tellers = Executors.newVirtualThreadPerTaskExecutor()) {
			for (int thread = 0; thread < threads; thread++) {
				tellers.submit(() -> {
					together.await();
					for (int told = 0; told < each; told++) {
						changes.tell(useCase, Kind.READ, UUID.randomUUID());
					}
					return null;
				});
			}
			together.countDown();
			tellers.shutdown();
			assertThat(tellers.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
		}

		// A sink told by two threads at once refuses one of them; every change here arrived.
		assertThat(heard).hasSize(threads * each);
	}

}
