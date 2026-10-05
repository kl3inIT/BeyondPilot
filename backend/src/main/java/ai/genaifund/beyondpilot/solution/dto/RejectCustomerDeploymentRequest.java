package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "RejectCustomerDeployment",
		description = "Why a customer deployment is not approved, and what the owners are told.")
public record RejectCustomerDeploymentRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "incomplete", "unverifiable", "other" }) @NotNull @Pattern(
						regexp = SolutionCodes.DEPLOYMENT_REJECTION) String reason,
		@Schema(types = { "string", "null" },
				description = "Shown to the owners with the rejection.") @Size(max = 1000) @Nullable String message) {
}
