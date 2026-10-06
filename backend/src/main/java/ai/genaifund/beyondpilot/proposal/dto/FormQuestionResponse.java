package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "FormQuestion", description = "One of the program's own questions, as the form asks it.")
public record FormQuestionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "short_text", "long_text", "single_choice", "file", "link",
				"confirm" }) String kind,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String label, @Schema(types = { "string", "null" }) @Nullable String help,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean required, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> options,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The longest answer the form takes.") int maxLength) {
}
