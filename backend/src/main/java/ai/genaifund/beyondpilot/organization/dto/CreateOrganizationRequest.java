package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) @NotNull @Pattern(
						regexp = OrganizationCodes.TYPE) String type,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 300) @Pattern(
				regexp = OrganizationCodes.WEBSITE) String website,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "ISO 3166-1 alpha-2.") @NotNull @Pattern(
				regexp = OrganizationCodes.COUNTRY) String country,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Pattern(
				regexp = OrganizationCodes.TEAM_SIZE) String teamSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The industries it works in or serves, as the codes the solutions use.") @NotNull @Size(
						min = 1,
						max = 5) List<@NotNull @Pattern(regexp = OrganizationCodes.INDUSTRY) String> industries,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What it does and for whom, in at most 280 characters.") @NotBlank @Size(
						max = 280) String description,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The year it started; for an independent builder, the year the practice did.") @NotNull @Min(1800) @Max(2100) Integer foundedYear,
		@Schema(types = { "string", "null" }, description = "The address of its logo.") @Size(max = 300) @Pattern(
				regexp = OrganizationCodes.WEBSITE) @Nullable String logoUrl,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What the creator does in the organization.") @NotBlank @Size(
						max = 120) String jobTitle) {
}
