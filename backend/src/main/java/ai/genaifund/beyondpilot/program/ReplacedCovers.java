package ai.genaifund.beyondpilot.program;

import java.util.UUID;

import ai.genaifund.beyondpilot.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Removes a cover that a program stopped naming, once the save that replaced it has committed. Removed earlier, a save
 * that then rolled back would leave the program naming a file that is gone.
 */
@Component
class ReplacedCovers {

	private static final Logger LOG = LoggerFactory.getLogger(ReplacedCovers.class);

	private final StorageService storage;

	ReplacedCovers(StorageService storage) {
		this.storage = storage;
	}

	/** The save has committed, so its transaction is over: the removal needs one of its own. */
	@TransactionalEventListener
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	void remove(CoverReplaced replaced) {
		try {
			storage.delete(replaced.fileId());
		}
		catch (RuntimeException failure) {
			// The program is saved; the file is only left behind.
			LOG.atWarn()
				.addKeyValue("event", "program.cover.removal_failed")
				.addKeyValue("program_id", replaced.programId())
				.addKeyValue("file_id", replaced.fileId())
				.addKeyValue("error_type", failure.getClass().getName())
				.log("A replaced cover could not be removed");
		}
	}

	/** A program stopped naming the file as its cover. */
	record CoverReplaced(UUID programId, UUID fileId) {
	}

}
