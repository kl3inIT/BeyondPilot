package ai.genaifund.beyondpilot.storage;

import java.util.UUID;

/**
 * A stored file as another module sees it.
 * @param uploadedByAccountId the account that uploaded it
 */
public record StoredFile(UUID id, FilePurpose purpose, String fileName, String mediaType, long sizeBytes,
		UUID uploadedByAccountId) {
}
