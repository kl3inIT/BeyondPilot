package ai.genaifund.beyondpilot.program.dto;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProgramEvent", description = "A session of a program that people register for somewhere else.")
public record ProgramEventEntry(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 160) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull Instant startsAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "Not before `startsAt`.") @Nullable Instant endsAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean online,
		@Schema(types = { "string", "null" }) @Size(max = 80) @Nullable String city,
		@Schema(types = { "string", "null" }) @Size(max = 80) @Nullable String country,
		@Schema(types = { "string", "null" }, format = "uri",
				description = "Where people register, for example on Luma.") @Size(max = 2000) @Pattern(
						regexp = SaveProgramRequest.WEB_ADDRESS) @Nullable String registrationUrl) {
}
