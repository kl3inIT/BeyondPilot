package ai.genaifund.beyondpilot.proposal.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "ApplicantOrganization",
		description = "Who applies, for someone in no organization: themselves on their own, or their team.")
public record ApplicantOrganizationRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "individual", "team" }) @NotNull @Pattern(
				regexp = "individual|team") String kind,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The person's name for an individual; the team's name for a team.") @NotBlank @Size(
						max = 120) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "ISO 3166-1 alpha-2.") @NotNull @Pattern(
				regexp = "^[A-Z]{2}$") String country,
		@Schema(types = { "string", "null" }, allowableValues = { "2_9", "10_49", "50_99" },
				description = "A team's size; an individual is one person.") @Pattern(
						regexp = "2_9|10_49|50_99") @Nullable String teamSize,
		@Schema(types = { "string", "null" }) @Size(max = 300) @Pattern(
				regexp = "^https?://\\S+$") @Nullable String website) {
}
