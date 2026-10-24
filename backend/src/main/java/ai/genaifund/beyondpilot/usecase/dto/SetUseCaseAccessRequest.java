package ai.genaifund.beyondpilot.usecase.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Schema(name = "SetUseCaseAccess", description = "What one person may do with a use case.")
public record SetUseCaseAccessRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
		allowableValues = { "viewer", "editor", "full_access" }) @NotNull @Pattern(
				regexp = "viewer|editor|full_access") String role) {
}
