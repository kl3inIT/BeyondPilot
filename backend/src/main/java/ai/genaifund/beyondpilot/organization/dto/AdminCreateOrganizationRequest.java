package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
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
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(min = 1,
				max = 2) List<@NotNull @Pattern(regexp = OrganizationCodes.ROLE) String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) @NotNull @Pattern(
						regexp = OrganizationCodes.TYPE) String type,
		@Schema(types = { "string", "null" }) @Size(max = 300) @Pattern(
				regexp = OrganizationCodes.WEBSITE) @Nullable String website,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Pattern(
				regexp = OrganizationCodes.COUNTRY) @Nullable String country,
		@Schema(types = { "string", "null" }, example = "tasco.com.vn",
				description = "The domain of the company's work addresses. The first person who signs in on it may own the organization at once.") @Size(
						max = 253) @Pattern(
								regexp = "[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+") @Nullable String emailDomain,
		@Schema(types = { "string", "null" },
				description = "The address invited to own it.") @Email @Size(max = 254) @Nullable String ownerEmail) {
}
