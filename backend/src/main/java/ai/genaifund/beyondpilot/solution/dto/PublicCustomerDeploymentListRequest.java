package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** Whose customer deployments are read, and which page of them. */
public record PublicCustomerDeploymentListRequest(
		@Parameter(description = "The address of the organization's public page.", required = true) @NotBlank @Size(
				max = 120) String organization,
		@Parameter(description = "The page, from 1.") @Min(1) @Max(1000) @Nullable Integer page) {
}
