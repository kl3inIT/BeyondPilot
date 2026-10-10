package ai.genaifund.beyondpilot.matching.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "GiveMatchingFeedback",
		description = "Whether the AI put a candidate in the right group, and where it belongs when it did not.")
public record GiveFeedbackRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the group the AI gave is the right one.") @NotNull Boolean agrees,
		@Schema(description = "The group the candidate belongs in; required when the caller does not agree, never the AI's own, and absent when the caller agrees.",
				allowableValues = { "direct", "industry", "technology", "none" }) @Nullable @Pattern(
						regexp = "direct|industry|technology|none") String expectedBucket,
		@Schema(description = "The places of the requirements the AI judged wrongly, if the caller names any.") @Nullable @Size(
				max = 50) List<@NotNull @Min(1) Integer> requirements,
		@Schema(description = "A few words more, if the person wants.") @Nullable @Size(
				max = 500) String note) {
}
