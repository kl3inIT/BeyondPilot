package ai.genaifund.beyondpilot.perk.dto;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PerkPage", description = "A published perk's page, and what the caller may do with it.")
public record PerkPageResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) PerkCardResponse card,
		@Schema(types = { "string", "null" }) @Nullable String about, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> steps,
		@Schema(types = { "string", "null" }) @Nullable String terms,
		@Schema(types = { "string", "null" }) @Nullable String termsUrl,
		@Schema(types = { "string", "null" },
				description = "The partner's page, for a link perk for everyone; for any other perk it comes with a claim.") @Nullable String url,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant startsAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "What a request asks.") List<PerkQuestionEntry> questions,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean requireApproval, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean perPerson,
		@Schema(types = { "integer", "null" },
				description = "How many places are left; null when it has no limit.") @Nullable Integer placesLeft,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The listed solutions it goes with.") List<PerkSolutionResponse> solutions,
		@Schema(types = { "object", "null" }, description = "What the caller holds of it.") @Nullable PerkClaimResponse claim) {
}
