package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "TakeDownOrganization",
		description = "Why an approved organization is taken down, and what its owners are told.")
public record TakeDownOrganizationRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "misleading_information", "not_a_real_organization", "breaks_the_rules",
						"other" }) @NotNull @Pattern(
								regexp = "misleading_information|not_a_real_organization|breaks_the_rules|other") String reason,
		@Schema(types = { "string", "null" },
				description = "Shown to the owners in the email and in their workspace.") @Size(
						max = 1000) @Nullable String message) {
}
