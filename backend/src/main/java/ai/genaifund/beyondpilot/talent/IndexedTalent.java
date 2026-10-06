package ai.genaifund.beyondpilot.talent;

import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/** An approved, listed talent profile as search indexes it: what its page says, never the person's address. */
public record IndexedTalent(UUID id, String slug, String name, @Nullable String headline, @Nullable String bio,
		List<String> roles, List<String> skills, @Nullable String country, @Nullable String availability) {
}
