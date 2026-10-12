package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "SaveOrganizationBasics",
		description = "The facts a person gives when they make an organization. The rest of the profile is left as it is.")
public record SaveOrganizationBasicsRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) @NotNull @Pattern(
						regexp = OrganizationCodes.TYPE) String type,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Pattern(
				regexp = OrganizationCodes.TEAM_SIZE) String teamSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The industries it works in or serves; a company names at least one.") @NotNull @Size(
						max = 5) List<@NotNull @Pattern(regexp = OrganizationCodes.INDUSTRY) String> industries,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "ISO 3166-1 alpha-2.") @NotNull @Pattern(
				regexp = OrganizationCodes.COUNTRY) String country) {
}
