package ai.genaifund.beyondpilot.perk.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "TeamClaim", description = "A perk the caller's organization got, with what it holds.")
public record TeamClaimResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(types = { "string", "null" }) @Nullable String value, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String partnerName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) PerkClaimResponse claim) {
}
