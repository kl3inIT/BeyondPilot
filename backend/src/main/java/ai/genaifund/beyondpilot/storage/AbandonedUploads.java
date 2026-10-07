package ai.genaifund.beyondpilot.storage;

import java.time.Duration;
import java.time.Instant;

import ai.genaifund.beyondpilot.storage.adapter.ObjectStorageAdapterRegistry;
import ai.genaifund.beyondpilot.storage.persistence.StorageFile;
import ai.genaifund.beyondpilot.storage.persistence.StorageFileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Removes the uploads that were reserved and never confirmed: the person closed the page or lost the connection. An
 * upload is confirmed seconds after it is sent, so one still pending a day after its time to send ran out never will
 * be. A stored file is never touched.
 */
@Component
@EnableScheduling
class AbandonedUploads {

	private static final Logger LOG = LoggerFactory.getLogger(AbandonedUploads.class);

	static final Duration KEEP = Duration.ofDays(1);

	private final StorageFileRepository files;
	private final ObjectStorageAdapterRegistry adapters;
	private final TransactionTemplate transactions;

	AbandonedUploads(StorageFileRepository files, ObjectStorageAdapterRegistry adapters,
			TransactionTemplate transactions) {
		this.files = files;
		this.adapters = adapters;
		this.transactions = transactions;
	}

	@Scheduled(cron = "0 45 3 * * *", zone = "Asia/Ho_Chi_Minh")
	void removeEveryNight() {
		remove(Instant.now());
	}

	/** Removes each abandoned upload on its own, so one that fails leaves the others removed. */
	int remove(Instant now) {
		int removed = 0;
		for (StorageFile file : files.findAbandoned(now.minus(KEEP))) {
			try {
				transactions.executeWithoutResult(status -> files.deleteById(file.getId()));
				adapters.adapter(file.getProvider()).delete(file.getObjectKey());
				removed++;
			}
			// A row another module still points at, or bytes the store would not delete: kept, tried again next night.
			catch (RuntimeException exception) {
				LOG.atWarn()
					.addKeyValue("event", "storage.abandoned_upload.kept")
					.addKeyValue("file_id", file.getId())
					.addKeyValue("error_type", exception.getClass().getName())
					.log("An abandoned upload could not be removed");
			}
		}
		if (removed > 0) {
			LOG.atInfo()
				.addKeyValue("event", "storage.abandoned_upload.removed")
				.addKeyValue("count", removed)
				.log("Abandoned uploads removed");
		}
		return removed;
	}
}
