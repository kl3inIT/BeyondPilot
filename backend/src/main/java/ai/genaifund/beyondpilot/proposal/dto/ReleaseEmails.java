package ai.genaifund.beyondpilot.proposal.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "ReleaseEmails",
		description = "The email each group gets. {organization} and {solution} are filled in for each applicant.")
public record ReleaseEmails(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 200) String shortlistedSubject,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 5000) String shortlistedMessage,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 200) String notSelectedSubject,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 5000) String notSelectedMessage) {
}
