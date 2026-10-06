package ai.genaifund.beyondpilot.proposal.dto;

import java.util.Map;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveAssessment",
		description = "The caller's assessment: a score from 1 to 5 for every criterion and a private note, or a conflict of interest without scores.")
public record SaveAssessmentRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "By criterion identifier.") @NotNull Map<UUID, Integer> scores,
		@Schema(types = { "string", "null" }) @Size(max = 2000) @Nullable String note,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The caller knows the applicant, so their score is left out.") boolean conflict) {
}
