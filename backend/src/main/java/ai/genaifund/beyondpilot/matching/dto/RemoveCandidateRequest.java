package ai.genaifund.beyondpilot.matching.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "RemoveMatchingCandidate", description = "Why a candidate is taken off the list.")
public record RemoveCandidateRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "not_relevant", "already_known", "not_credible", "other" }) @NotNull @Pattern(
						regexp = "not_relevant|already_known|not_credible|other") String reason,
		@Schema(description = "A few words more; needed when the reason is other.") @Nullable @Size(max = 500) String note) {
}
