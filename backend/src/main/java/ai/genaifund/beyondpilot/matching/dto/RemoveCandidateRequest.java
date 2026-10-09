package ai.genaifund.beyondpilot.matching.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "RemoveMatchingCandidate", description = "Why a candidate is taken off the list.")
public record RemoveCandidateRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "does_not_solve", "wrong_industry_or_size", "closed_or_wrong_website", "duplicate", "other" }) @NotNull @Pattern(
						regexp = "does_not_solve|wrong_industry_or_size|closed_or_wrong_website|duplicate|other") String reason,
		@Schema(description = "A few words more, if the person wants.") @Nullable @Size(max = 500) String note) {
}
