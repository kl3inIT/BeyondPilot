package ai.genaifund.beyondpilot.usecase.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Schema(name = "SetUseCaseMemberAccess", description = "What every other member of the organization may do with a use case.")
public record SetUseCaseMemberAccessRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
		allowableValues = { "none", "viewer", "editor", "full_access" }) @NotNull @Pattern(
				regexp = "none|viewer|editor|full_access") String role) {
}
