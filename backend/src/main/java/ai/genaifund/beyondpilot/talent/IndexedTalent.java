package ai.genaifund.beyondpilot.talent;

import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * An approved, listed talent profile as search indexes it: what its page says, never the person's address.
 * @param photoFileId the photo, read at the public address of stored files
 */
public record IndexedTalent(UUID id, String slug, String name, @Nullable String headline, @Nullable String bio,
		List<String> roles, List<String> skills, List<String> industries, @Nullable String country,
		@Nullable String city, @Nullable String worksAt, @Nullable UUID photoFileId) {
}
