package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ReviewProgram", description = "A program whose applications the caller scores.")
public record ReviewProgramResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant closesAt,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate outcomesDueOn,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean released,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many submitted applications there are.") long applications,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many of them the caller scored or stepped back from.") long assessed) {
}
