package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveCustomerDeployment", description = "A customer deployment as its form holds it.")
public record SaveCustomerDeploymentRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The customer as it may be published: a name, or a description that does not name it.") @NotBlank @Size(
						max = 120) String customer,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 1000) String problem,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 1000) String delivered,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "pilot", "production" }) @NotNull @Pattern(regexp = SolutionCodes.STAGE) String stage,
		@Schema(types = { "string", "null" }) @Size(max = 120) @Nullable String channels,
		@Schema(types = { "string", "null" }) @Size(max = 120) @Nullable String languages,
		@Schema(types = { "string", "null" }) @Size(max = 120) @Nullable String period,
		@Schema(types = { "string", "null" }) @Size(max = 300) @Nullable String result,
		@Schema(types = { "integer", "null" }, format = "int64",
				description = "The version the form read; absent for a new deployment.") @Nullable Long version) {
}
