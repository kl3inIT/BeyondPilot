package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminSaveOrganization",
		description = "The profile of an organization and its verified domain, as an operator saves them.")
public record AdminSaveOrganizationRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Valid SaveOrganizationRequest profile,
		@Schema(types = { "string", "null" },
				description = "The domain GenAI Fund verifies for the organization; null clears it.") @Size(
						max = 253) @Pattern(regexp = OrganizationCodes.DOMAIN) @Nullable String emailDomain) {
}
