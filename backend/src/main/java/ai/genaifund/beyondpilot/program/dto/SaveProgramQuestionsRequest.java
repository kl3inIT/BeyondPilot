package ai.genaifund.beyondpilot.program.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(name = "SaveProgramQuestions", description = "Every question of a program, in the order the form asks them.")
public record SaveProgramQuestionsRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 20) List<@NotNull @Valid ProgramQuestionEntry> questions,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The version of the program the screen read.") @NotNull Long version) {
}
