package ai.genaifund.beyondpilot.program.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProgramSummary", description = "A published program as the public list shows it.")
public record ProgramSummaryResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The address under /programs.") String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "enterprise_challenge", "open_innovation_call", "accelerator", "hackathon",
						"buildathon", "grant", "venture_building", "pitch_competition", "event_series",
						"event" }) String type,
		@Schema(types = { "string", "null" }) @Nullable String partnerName,
		@Schema(types = { "string", "null" }) @Nullable String summary,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The cover, read at the public address of stored files.") @Nullable UUID coverFileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "upcoming", "open", "running", "done" },
				description = "Where the program stands now, worked out from its dates.") String phase,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate startsOn,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate endsOn,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "standard", "custom", "external" },
				description = "`external` links to `externalUrl` instead of a page here.") String pageKind,
		@Schema(types = { "string", "null" }, format = "uri") @Nullable String externalUrl,
		@Schema(description = "Null for a program that takes no applications here.") @Nullable ProgramApplications applications,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Its events still to come, soonest first, at most three.") List<ProgramEventEntry> upcomingEvents) {
}
