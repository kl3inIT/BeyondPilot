package ai.genaifund.beyondpilot.talent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "TalentDecision",
		description = "Why GenAI Fund sends a talent profile back or takes it down, and what its person is told.")
public record TalentDecisionRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "incomplete", "unverifiable", "inappropriate",
						"other" }) @NotNull @Pattern(regexp = TalentCodes.DECISION_REASON) String reason,
		@Schema(types = { "string", "null" },
				description = "Shown to the person with the decision, and sent to them by email.") @Size(max = 1000) @Nullable String message) {
}
