package ai.genaifund.beyondpilot.talent;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * An approved, listed talent profile as search indexes it: what its page says, never the person's address.
 * @param photoFileId the photo, read at the public address of stored files
 * @param aiDeclined whether the person declined AI processing of their data, so that the profile is not sent to an
 * embedding provider (BEY-240)
 */
public record IndexedTalent(UUID id, String slug, String name, @Nullable String headline, @Nullable String bio,
		List<String> roles, List<String> skills, List<String> industries, @Nullable String country,
		@Nullable String city, @Nullable String worksAt, @Nullable UUID photoFileId, @Nullable Instant publishedAt,
		int projectCount, @Nullable String leadProjectTitle, @Nullable String leadProjectStage, boolean featured,
		boolean aiDeclined) {
}
