package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "CreateOrganization",
		description = "A new organization. Its creator owns it, and it waits for GenAI Fund's review.")
public record CreateOrganizationRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "One or both of `provider` and `enterprise`.") @NotNull @Size(min = 1,
						max = 2) List<@NotNull @Pattern(regexp = OrganizationCodes.ROLE) String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) @NotNull @Pattern(
						regexp = OrganizationCodes.TYPE) String type,
		@Schema(types = { "string", "null" }) @Size(max = 300) @Pattern(
				regexp = OrganizationCodes.WEBSITE) @Nullable String website,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Pattern(
				regexp = OrganizationCodes.COUNTRY) @Nullable String country,
		@Schema(types = { "string", "null" }) @Pattern(regexp = OrganizationCodes.TEAM_SIZE) @Nullable String teamSize,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String description) {
}
