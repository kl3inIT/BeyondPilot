package ai.genaifund.beyondpilot.program.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminProgramSummary", description = "One program in the operators' list.")
public record AdminProgramSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "enterprise_challenge", "open_innovation_call", "accelerator", "hackathon",
						"buildathon", "grant", "venture_building", "pitch_competition", "event_series",
						"event" }) String type,
		@Schema(types = { "string", "null" }) @Nullable String partnerName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "draft", "published" }) String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "upcoming", "open", "running", "done" },
				description = "Where the program would stand now, worked out from its dates; a draft is shown as a draft whatever its phase.") String phase,
		@Schema(description = "Null for a program that takes no applications here.") @Nullable ProgramApplications applications,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate startsOn,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate endsOn,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt) {
}
