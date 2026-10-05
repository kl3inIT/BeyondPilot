package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveOrganization", description = "The profile of an organization as its Profile screen holds it.")
public record SaveOrganizationRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "One or both of `provider` and `enterprise`.") @NotNull @Size(min = 1,
						max = 2) List<@NotNull @Pattern(regexp = OrganizationCodes.ROLE) String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) @NotNull @Pattern(
						regexp = OrganizationCodes.TYPE) String type,
		@Schema(types = { "string", "null" }) @Size(max = 300) @Pattern(
				regexp = OrganizationCodes.WEBSITE) @Nullable String website,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "ISO 3166-1 alpha-2.") @NotNull @Pattern(
				regexp = OrganizationCodes.COUNTRY) String country,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Pattern(
				regexp = OrganizationCodes.TEAM_SIZE) String teamSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The industries it works in or serves, as the codes the solutions use.") @NotNull @Size(
						min = 1,
						max = 5) List<@NotNull @Pattern(regexp = OrganizationCodes.INDUSTRY) String> industries,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String description,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The version the screen read.") @NotNull Long version) {
}
