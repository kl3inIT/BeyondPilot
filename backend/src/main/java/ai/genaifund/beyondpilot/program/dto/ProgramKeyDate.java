package ai.genaifund.beyondpilot.program.dto;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProgramKeyDate", description = "A dated step of a program that an applicant plans around.")
public record ProgramKeyDate(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 160) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull Instant startsAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "Not before `startsAt`.") @Nullable Instant endsAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The step is a day, not a moment; it is shown without a time.") boolean allDay,
		@Schema(types = { "string", "null" }) @Size(max = 500) @Nullable String note) {
}
