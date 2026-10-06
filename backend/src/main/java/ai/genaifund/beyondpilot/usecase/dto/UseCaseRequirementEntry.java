package ai.genaifund.beyondpilot.usecase.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "UseCaseRequirement", description = "One thing the solution must do.")
public record UseCaseRequirementEntry(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 300) String statement,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "required", "optional" }) @NotNull @Pattern(
						regexp = UseCaseCodes.NECESSITY) String necessity) {
}
