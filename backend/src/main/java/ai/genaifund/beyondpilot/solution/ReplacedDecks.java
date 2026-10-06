package ai.genaifund.beyondpilot.solution;

import java.util.UUID;

import ai.genaifund.beyondpilot.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Removes a deck that a solution stopped naming, once the save or the deletion that dropped it has committed. Removed
 * earlier, a change that then rolled back would leave the solution naming a file that is gone.
 */
@Component
class ReplacedDecks {

	private static final Logger LOG = LoggerFactory.getLogger(ReplacedDecks.class);

	private final StorageService storage;

	ReplacedDecks(StorageService storage) {
		this.storage = storage;
	}

	/** The change has committed, so its transaction is over: the removal needs one of its own. */
	@TransactionalEventListener
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	void remove(DeckReplaced replaced) {
		try {
			storage.delete(replaced.fileId());
		}
		catch (RuntimeException failure) {
			// The solution is saved; the file is only left behind.
			LOG.atWarn()
				.addKeyValue("event", "solution.deck.removal_failed")
				.addKeyValue("solution_id", replaced.solutionId())
				.addKeyValue("file_id", replaced.fileId())
				.addKeyValue("error_type", failure.getClass().getName())
				.log("A replaced deck could not be removed");
		}
	}

	/** A solution stopped naming the file as its deck. */
	record DeckReplaced(UUID solutionId, UUID fileId) {
	}

}
