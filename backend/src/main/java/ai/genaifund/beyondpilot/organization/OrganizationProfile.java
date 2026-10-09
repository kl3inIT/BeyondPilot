package ai.genaifund.beyondpilot.organization;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

/** Who an organization is, as another module shows it or keeps a copy of it. */
public record OrganizationProfile(UUID id, String slug, String name, String type, @Nullable String country,
		@Nullable String teamSize, @Nullable String website, @Nullable Integer foundedYear,
		@Nullable String companySizeLabel, @Nullable UUID logoFileId, boolean approved) {
}
