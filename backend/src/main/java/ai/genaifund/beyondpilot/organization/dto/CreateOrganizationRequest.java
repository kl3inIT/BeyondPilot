package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;
import java.util.UUID;

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
@RequiredOfCompany
public record CreateOrganizationRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) @NotNull @Pattern(
						regexp = OrganizationCodes.TYPE) String type,
		@Schema(types = { "string", "null" },
				description = "A company gives one; a team, a builder or another organization may leave it out.") @Size(
						max = 300) @Pattern(regexp = OrganizationCodes.WEBSITE) @Nullable String website,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "ISO 3166-1 alpha-2.") @NotNull @Pattern(
				regexp = OrganizationCodes.COUNTRY) String country,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Pattern(
				regexp = OrganizationCodes.TEAM_SIZE) String teamSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The industries it works in or serves, as the codes the solutions use. A company names one to five; a team or a builder may name none.") @NotNull @Size(
						max = 5) List<@NotNull @Pattern(regexp = OrganizationCodes.INDUSTRY) String> industries,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What it does and for whom, in at most 280 characters.") @NotBlank @Size(
						max = 280) String description,
		@Schema(types = { "integer", "null" },
				description = "The year it started; for an independent builder, the year the practice did. A company gives it; a team, a builder or another organization may leave it out.") @Min(1800) @Max(2100) @NotAfterThisYear @Nullable Integer foundedYear,
		@Schema(types = { "string", "null" },
				description = "A logo the caller uploaded for an organization; null for none.") @Nullable UUID logoFileId,
		@Schema(types = { "string", "null" },
				description = "What the creator does in the organization.") @Size(max = 120) @Nullable String jobTitle,
		@Schema(types = { "string", "null" }, description = "What the team has built before, separate from its short description.") @Size(max = 2000) @Nullable String teamBackground) {
}
