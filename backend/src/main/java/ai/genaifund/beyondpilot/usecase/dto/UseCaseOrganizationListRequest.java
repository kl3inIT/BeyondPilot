package ai.genaifund.beyondpilot.usecase.dto;

import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the organizations an operator can pick for a use case. */
public record UseCaseOrganizationListRequest(
		@Parameter(description = "Organizations whose name contains this, ignoring case.") @Size(
				max = 100) @Nullable String q) {
}
