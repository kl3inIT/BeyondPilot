package ai.genaifund.beyondpilot.storage.adapter;

import java.time.Duration;
import java.util.UUID;

/**
 * One upload an adapter is asked to permit.
 * @param sizeBytes the exact length the upload must have
 * @param token the single-use secret of this upload, for a store that receives the bytes through this application
 */
public record UploadSpecification(UUID fileId, String objectKey, String mediaType, long sizeBytes, Duration lifetime,
		String token) {
}
