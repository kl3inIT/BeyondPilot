package ai.genaifund.beyondpilot.talent.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PublicTalentSummary", description = "One profile in the public directory of talent.")
public record PublicTalentSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }) @Nullable String headline,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Nullable String country,
		@Schema(types = { "string", "null" }) @Nullable String city,
		@Schema(types = { "string", "null" },
				allowableValues = { "available", "open_to_offers", "not_available" }) @Nullable String availability,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> skills,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "Read at /api/storage/files/{id}; null for none.") @Nullable UUID photoFileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many projects the profile shows.") int projectCount,
		@Schema(oneOf = TalentProjectDto.class, types = { "object", "null" },
				description = "The first project the profile shows; null when it shows none.") @Nullable TalentProjectDto leadProject) {
}
