package ai.genaifund.beyondpilot.usecase.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(name = "SetUseCasePreview", description = "Turns the read-only link to a use case on or off.")
public record SetUseCasePreviewRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull Boolean enabled) {
}
