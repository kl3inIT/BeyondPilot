package ai.genaifund.beyondpilot.storage;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A stored file as another module sees it.
 * @param uploadedByAccountId the account that uploaded it; null for a file the server stored itself
 */
public record StoredFile(UUID id, FilePurpose purpose, String fileName, String mediaType, long sizeBytes,
		@Nullable UUID uploadedByAccountId) {
}
