package ai.genaifund.beyondpilot.ai.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import org.jspecify.annotations.Nullable;

@Schema(name = "SetTaskModel", description = "The model a task uses from now on.")
public record SetTaskModelRequest(
		@Schema(types = { "string", "null" }, format = "uuid", description = "The model; null leaves the task without one.") @Nullable UUID modelId,
		@Schema(types = { "string", "null" }, allowableValues = { "off", "low", "medium", "high" },
				description = "How hard to reason; null returns the task to its own default.") @Pattern(regexp = "off|low|medium|high") @Nullable String reasoningEffort,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The version the task was read at.") long version) {
}
