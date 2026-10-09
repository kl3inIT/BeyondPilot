package ai.genaifund.beyondpilot.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "OcrProviderTest",
		description = "What the service answered when it was sent the picture BeyondPilot carries for this test. The test spends one call.")
public record OcrProviderTestResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether the service answered and the line of text on the picture is in what it read.") boolean ok,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long latencyMs,
		@Schema(types = { "string", "null" }, allowableValues = { "rejected", "unreachable", "incompatible", "refused", "misread" },
				description = "Why it failed: the key was refused, no answer came, the answer was not this API's, the service would not take the picture, or it answered without the text on the picture.") @Nullable String reason) {
}
