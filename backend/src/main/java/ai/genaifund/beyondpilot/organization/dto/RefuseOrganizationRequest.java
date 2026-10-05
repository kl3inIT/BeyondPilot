package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "RefuseOrganization", description = "Why an organization is not approved, and what its owners are told.")
public record RefuseOrganizationRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "duplicate", "not_a_real_organization", "incomplete", "out_of_scope",
						"other" }) @NotNull @Pattern(
								regexp = "duplicate|not_a_real_organization|incomplete|out_of_scope|other") String reason,
		@Schema(types = { "string", "null" },
				description = "Shown to the owners with the refusal.") @Size(max = 1000) @Nullable String message) {
}
