package ai.genaifund.beyondpilot.program.dto;

import java.time.Instant;
import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProgramApplications", description = "When and how a program takes applications here.")
public record ProgramApplications(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull Instant opensAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The deadline; later than `opensAt`.") @NotNull Instant closesAt,
		@Schema(types = { "integer", "null" }, format = "int32",
				description = "How many applications go on to the next round.") @Positive @Nullable Integer shortlistSize,
		@Schema(types = { "string", "null" }, format = "date",
				description = "The day applicants hear the outcome; not before the deadline.") @Nullable LocalDate outcomesDueOn,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether an applicant may change a submitted application until the deadline.") boolean allowUpdatesUntilClose) {
}
