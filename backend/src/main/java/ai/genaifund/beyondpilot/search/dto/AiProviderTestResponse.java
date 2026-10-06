package ai.genaifund.beyondpilot.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AiProviderTest", description = "How embedding one test sentence went. Nothing is stored.")
public record AiProviderTestResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean ok, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String model,
		@Schema(types = { "integer", "null" }, format = "int32", description = "The length of the vector the provider gave.") @Nullable Integer dimensions,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How long the provider took, in milliseconds.") long latencyMs,
		@Schema(types = { "string", "null" }, allowableValues = { "rejected", "model_refused", "unreachable", "wrong_dimensions" },
				description = "Why it failed; null when it worked.") @Nullable String reason) {
}
