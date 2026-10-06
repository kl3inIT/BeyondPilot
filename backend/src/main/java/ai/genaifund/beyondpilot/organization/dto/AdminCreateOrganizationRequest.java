package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminCreateOrganization", description = """
		An organization an operator creates for a company that is not here yet. It is approved from the start and \
		has no member until someone accepts the invitation to own it, or claims it.""")
public record AdminCreateOrganizationRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) @NotNull @Pattern(
						regexp = OrganizationCodes.TYPE) String type,
		@Schema(types = { "string", "null" }) @Size(max = 300) @Pattern(
				regexp = OrganizationCodes.WEBSITE) @Nullable String website,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Pattern(
				regexp = OrganizationCodes.COUNTRY) @Nullable String country,
		@Schema(types = { "string", "null" }) @Pattern(regexp = OrganizationCodes.TEAM_SIZE) @Nullable String teamSize,
		@Schema(types = { "array", "null" },
				description = "The industries it works in or serves, as the codes the solutions use.") @Size(
						max = 5) @Nullable List<@NotNull @Pattern(regexp = OrganizationCodes.INDUSTRY) String> industries,
		@Schema(types = { "string", "null" },
				description = "What it does and for whom, in at most 280 characters.") @Size(
						max = 280) @Nullable String description,
		@Schema(types = { "integer", "null" }, description = "The year it started.") @Min(1800) @Max(
				2100) @Nullable Integer foundedYear,
		@Schema(types = { "string", "null" }, description = "The address of its logo.") @Size(max = 300) @Pattern(
				regexp = OrganizationCodes.WEBSITE) @Nullable String logoUrl,
		@Schema(types = { "string", "null" }, example = "tasco.com.vn",
				description = "The domain of the company's work addresses, which the operator vouches for.") @Size(
						max = 253) @Pattern(regexp = OrganizationCodes.DOMAIN) @Nullable String emailDomain,
		@Schema(types = { "string", "null" },
				description = "The address invited to own it.") @Email @Size(max = 254) @Nullable String ownerEmail) {
}
