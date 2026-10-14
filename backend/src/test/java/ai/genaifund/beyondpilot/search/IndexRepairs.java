package ai.genaifund.beyondpilot.search;

import java.time.Duration;
import java.time.Instant;

import org.springframework.context.ApplicationContext;

/**
 * For a test that empties the index: the repair started with the application rebuilds it in the background, so a
 * test that empties it before that repair is over sees the repair's rows come back (BEY-195).
 */
public final class IndexRepairs {

	private static final Duration LONGEST = Duration.ofSeconds(60);

	private IndexRepairs() {
	}

	/** Waits until the repair started with this application has rebuilt the index once. */
	public static void awaitStartupRepair(ApplicationContext context) {
		IndexRepair repair = context.getBean(IndexRepair.class);
		Instant giveUp = Instant.now().plus(LONGEST);
		while (repair.lastRun() == null) {
			if (Instant.now().isAfter(giveUp)) {
				throw new IllegalStateException("The index was not repaired within " + LONGEST);
			}
			try {
				Thread.sleep(50);
			}
			catch (InterruptedException interrupted) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException(interrupted);
			}
		}
	}

}
