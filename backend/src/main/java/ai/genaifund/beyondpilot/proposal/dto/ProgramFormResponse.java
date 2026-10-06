package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProgramForm", description = "The program an application answers, with its window and its questions.")
public record ProgramFormResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant opensAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant closesAt,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate outcomesDueOn,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean allowUpdatesUntilClose,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether applications are taken now.") boolean open,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<FormQuestionResponse> questions) {
}
