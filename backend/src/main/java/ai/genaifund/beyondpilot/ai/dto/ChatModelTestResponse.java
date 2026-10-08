package ai.genaifund.beyondpilot.ai.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ChatModelTest", description = "Whether a model answered a one-line question. The call spent a few tokens and is in the usage record.")
public record ChatModelTestResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean ok,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long latencyMs) {
}
