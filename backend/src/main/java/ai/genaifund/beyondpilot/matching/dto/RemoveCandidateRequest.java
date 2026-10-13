package ai.genaifund.beyondpilot.matching.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "RemoveMatchingCandidate",
		description = "Takes a candidate off the list. The reason is optional: it can be given with the removal or afterwards.")
public record RemoveCandidateRequest(
		@Schema(description = "Why, if the person says.",
				allowableValues = { "does_not_solve", "wrong_industry_or_size", "closed_or_wrong_website", "duplicate", "other" }) @Pattern(
						regexp = "does_not_solve|wrong_industry_or_size|closed_or_wrong_website|duplicate|other") @Nullable String reason,
		@Schema(description = "A few words more, if the person wants.") @Nullable @Size(max = 500) String note) {
}
