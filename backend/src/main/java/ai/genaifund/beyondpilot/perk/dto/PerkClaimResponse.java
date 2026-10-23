package ai.genaifund.beyondpilot.perk.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PerkClaim", description = "What the caller holds of a perk.")
public record PerkClaimResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "taken", "waiting", "granted", "declined" }) String state,
		@Schema(types = { "string", "null" }, description = "The code it got, for a code perk.") @Nullable String code,
		@Schema(types = { "string", "null" }, description = "The partner's page, for a link perk.") @Nullable String url,
		@Schema(types = { "string", "null" }, description = "Where the code is redeemed.") @Nullable String redeemUrl,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Who got it.") String takenBy, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant takenAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant decidedAt) {
}
