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

@Schema(name = "SaveOrganizationBasics",
		description = "The required facts of the selected organization type. A save leaves optional profile facts unchanged.")
@RequiredOfCompany
@RequiredOrganizationDescription
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
				regexp = OrganizationCodes.COUNTRY) String country,
		@Schema(types = { "string", "null" },
				description = "Required for a company; omitted for other types.") @Size(max = 300) @Pattern(
						regexp = OrganizationCodes.WEBSITE) @Nullable String website,
		@Schema(types = { "integer", "null" },
				description = "Required for a company; omitted for other types.") @Min(1800) @Max(2100) @NotAfterThisYear @Nullable Integer foundedYear,
		@Schema(types = { "string", "null" },
				description = "Required for a team or company, including relevant expertise and experience; omitted for a builder on their own.") @Size(
						max = 280) @Nullable String description,
		@Schema(types = { "integer", "null" },
				description = "Required when editing; omitted when creating.") @Nullable Long version) {

	public static final class Builder {
		private final String name;
		private final String type;
		private final String teamSize;
		private final List<String> industries;
		private final String country;
		private @Nullable String website;
		private @Nullable Integer foundedYear;
		private @Nullable String description;
		private @Nullable Long version;

		public Builder(String name, String type, String teamSize, List<String> industries, String country) {
			this.name = name;
			this.type = type;
			this.teamSize = teamSize;
			this.industries = industries;
			this.country = country;
		}

		public Builder website(@Nullable String value) {
			website = value;
			return this;
		}

		public Builder foundedYear(@Nullable Integer value) {
			foundedYear = value;
			return this;
		}

		public Builder description(@Nullable String value) {
			description = value;
			return this;
		}

		public Builder version(@Nullable Long value) {
			version = value;
			return this;
		}

		public SaveOrganizationBasicsRequest build() {
			return new SaveOrganizationBasicsRequest(name, type, teamSize, industries, country,
					website, foundedYear, description, version);
		}
	}
}
