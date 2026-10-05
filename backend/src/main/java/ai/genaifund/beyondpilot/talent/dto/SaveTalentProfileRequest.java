package ai.genaifund.beyondpilot.talent.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveTalentProfile", description = "A talent profile as its edit screen holds it.")
public record SaveTalentProfileRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String name,
		@Schema(types = { "string", "null" },
				description = "One line shown in lists.") @Size(max = 160) @Nullable String headline,
		@Schema(types = { "string", "null" }) @Size(max = 4000) @Nullable String bio,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 4) List<@NotNull @Pattern(regexp = TalentCodes.ROLE) String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 15) List<@NotBlank @Size(max = 40) String> skills,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Pattern(
				regexp = TalentCodes.COUNTRY) @Nullable String country,
		@Schema(types = { "string", "null" },
				allowableValues = { "available", "open_to_offers", "not_available" }) @Pattern(
						regexp = TalentCodes.AVAILABILITY) @Nullable String availability,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 4) List<@NotNull @Pattern(regexp = TalentCodes.ENGAGEMENT) String> engagement,
		@Schema(types = { "string", "null" },
				allowableValues = { "under_25", "25_50", "50_100", "100_150", "150_plus" }) @Pattern(
						regexp = TalentCodes.RATE_BAND) @Nullable String rateBand,
		@Schema(types = { "string", "null" }) @Size(max = 300) @Pattern(
				regexp = TalentCodes.URL) @Nullable String website,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 6) List<@NotNull @Valid TalentProjectDto> projects,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it appears in the public directory once approved.") @NotNull Boolean listed,
		@Schema(types = { "integer", "null" }, format = "int64",
				description = "The version the screen read; null for the first save, which creates the profile.") @Nullable Long version) {
}
