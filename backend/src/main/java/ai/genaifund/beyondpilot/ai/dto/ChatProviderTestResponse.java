package ai.genaifund.beyondpilot.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ChatProviderTest", description = "What listing the provider's models answered. No tokens were spent.")
public record ChatProviderTestResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean ok,
		@Schema(types = { "integer", "null" }, description = "How many models the provider listed.") @Nullable Integer modelCount,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long latencyMs,
		@Schema(types = { "string", "null" }, allowableValues = { "rejected", "unreachable", "incompatible" },
				description = "Why it failed: the key was refused, no answer came, or the answer was not this API's.") @Nullable String reason) {
}
