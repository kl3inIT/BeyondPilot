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
 * Removes a file that a solution stopped naming, its deck or one of its images, once the save or the deletion that
 * dropped it has committed. Removed earlier, a change that then rolled back would leave the solution naming a file
 * that is gone.
 */
@Component
class DroppedFiles {

	private static final Logger LOG = LoggerFactory.getLogger(DroppedFiles.class);

	private final StorageService storage;

	DroppedFiles(StorageService storage) {
		this.storage = storage;
	}

	/** The change has committed, so its transaction is over: the removal needs one of its own. */
	@TransactionalEventListener
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	void remove(FileDropped dropped) {
		try {
			storage.delete(dropped.fileId());
		}
		catch (RuntimeException failure) {
			// The solution is saved; the file is only left behind.
			LOG.atWarn()
				.addKeyValue("event", "solution.file.removal_failed")
				.addKeyValue("solution_id", dropped.solutionId())
				.addKeyValue("file_id", dropped.fileId())
				.addKeyValue("error_type", failure.getClass().getName())
				.log("A file a solution stopped naming could not be removed");
		}
	}

	/** A solution stopped naming the file. */
	record FileDropped(UUID solutionId, UUID fileId) {
	}
}
