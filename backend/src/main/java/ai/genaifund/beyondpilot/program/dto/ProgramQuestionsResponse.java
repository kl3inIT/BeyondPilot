package ai.genaifund.beyondpilot.program.dto;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProgramQuestions", description = "The questions of a program as an operator edits them.")
public record ProgramQuestionsResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ProgramQuestionEntry> questions,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the applications have opened, which fixes the questions.") boolean fixed,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When the applications open; null while the program takes none.") @Nullable Instant opensAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Sent back with a save, which is refused when the program changed since.") long version) {
}
