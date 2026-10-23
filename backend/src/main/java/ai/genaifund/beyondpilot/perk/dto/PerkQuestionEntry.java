package ai.genaifund.beyondpilot.perk.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "PerkQuestion", description = "A question a request perk asks.")
public record PerkQuestionEntry(
		@Schema(types = { "string", "null" },
				description = "Its identifier, kept across saves so the answers already sent stay with it; left out for a new question.") @Nullable @Size(
						max = 40) @Pattern(regexp = "[a-z0-9-]+") String id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "What it asks.") @NotBlank @Size(max = 120) String label,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True for an answer of several lines, up to 2,000 characters; otherwise one line of up to 200.") boolean multiline,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean required) {
}
