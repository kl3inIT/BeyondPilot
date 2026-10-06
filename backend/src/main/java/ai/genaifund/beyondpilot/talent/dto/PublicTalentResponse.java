package ai.genaifund.beyondpilot.talent.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PublicTalent",
		description = "An approved, listed talent profile as anyone reads it. It carries no address of the person, and no rate.")
public record PublicTalentResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }) @Nullable String headline,
		@Schema(types = { "string", "null" }) @Nullable String bio,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> skills,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Nullable String country,
		@Schema(types = { "string", "null" },
				allowableValues = { "available", "open_to_offers", "not_available" }) @Nullable String availability,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> engagement,
		@Schema(types = { "string", "null" }) @Nullable String website,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "Read at /api/storage/files/{id}; null for none.") @Nullable UUID photoFileId,
		@Schema(types = { "string", "null" }) @Nullable String city,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "ISO 639-1 codes.") List<String> languages,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> industries,
		@Schema(types = { "string", "null" },
				description = "Where the person works, as they state it.") @Nullable String worksAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<TalentProjectDto> projects,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When the caller's message to this person was sent, while it waits for an answer; null for a visitor and when none waits.") @Nullable Instant waitingEnquirySentAt) {
}
