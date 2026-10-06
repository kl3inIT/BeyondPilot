package ai.genaifund.beyondpilot.talent.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "TalentProfile", description = "A talent profile as its person, and operators, see it.")
public record TalentProfileResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }) @Nullable String headline,
		@Schema(types = { "string", "null" }) @Nullable String bio,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> skills,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Nullable String country,
		@Schema(types = { "string", "null" },
				allowableValues = { "available", "open_to_offers", "not_available" }) @Nullable String availability,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> engagement,
		@Schema(types = { "string", "null" }, description = "US dollars an hour. Null is not stated.",
				allowableValues = { "under_25", "25_50", "50_100", "100_150", "150_plus" }) @Nullable String rateBand,
		@Schema(types = { "string", "null" }) @Nullable String website,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "Read at /api/storage/files/{id}; null for none.") @Nullable UUID photoFileId,
		@Schema(types = { "string", "null" }) @Nullable String city,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "ISO 639-1 codes.") List<String> languages,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> industries,
		@Schema(types = { "string", "null" },
				description = "Where the person works, as they state it.") @Nullable String worksAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<TalentProjectDto> projects,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "draft", "submitted", "approved", "changes_requested", "removed" }) String status,
		@Schema(types = { "string", "null" },
				allowableValues = { "incomplete", "unverifiable", "inappropriate", "other" },
				description = "Why GenAI Fund last asked for changes or removed it.") @Nullable String decisionReason,
		@Schema(types = { "string", "null" },
				description = "What the operator wrote to the person with the rejection.") @Nullable String decisionMessage,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it appears in the public directory once approved.") boolean listed,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it has what a submission needs: a headline, a bio, a role and a skill.") boolean complete,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant submittedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Sent back with a save, which is refused when the profile changed since.") long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt) {
}
