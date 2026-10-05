package ai.genaifund.beyondpilot.talent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "RejectTalent", description = "Why a talent profile is not approved, and what its person is told.")
public record RejectTalentRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "incomplete", "unverifiable", "inappropriate",
						"other" }) @NotNull @Pattern(regexp = TalentCodes.REJECTION) String reason,
		@Schema(types = { "string", "null" },
				description = "Shown to the person with the rejection.") @Size(max = 1000) @Nullable String message) {
}
