package ai.genaifund.beyondpilot.perk.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PerkClaimRow", description = "One claim of a perk as its partner reads it.")
public record PerkClaimRowResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "taken", "waiting", "granted", "declined" }) String state,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String personName, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String personEmail, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The answers by question identifier.") Map<String, String> answers,
		@Schema(types = { "string", "null" }) @Nullable String code, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant decidedAt,
		@Schema(types = { "string", "null" }) @Nullable String decidedBy, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long version) {
}
