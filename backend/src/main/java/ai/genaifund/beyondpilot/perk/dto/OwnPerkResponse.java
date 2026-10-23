package ai.genaifund.beyondpilot.perk.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "OwnPerk", description = "A perk as a list of the perks given shows it.")
public record OwnPerkResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(types = { "string", "null" }) @Nullable String value, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "draft", "published", "archived" }) String state,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "everyone", "members", "applicants", "shortlisted" }) String audience,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "link", "code", "codes", "request" }) String way,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean fromGenAiFund, @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many claims hold a place.") long taken,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many requests wait for an answer.") long waiting,
		@Schema(types = { "integer", "null" }) @Nullable Integer places,
		@Schema(types = { "integer", "null" },
				description = "How many codes are not given yet, for a perk given as a list.") @Nullable Integer codesLeft,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant endsAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt) {
}
