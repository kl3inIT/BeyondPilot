package ai.genaifund.beyondpilot.program.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Program", description = "A program as its public page shows it.")
public record ProgramResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The address under /programs.") String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "enterprise_challenge", "open_innovation_call", "accelerator", "hackathon",
						"buildathon", "grant", "venture_building", "pitch_competition", "event_series",
						"event" }) String type,
		@Schema(types = { "string", "null" }) @Nullable String partnerName,
		@Schema(types = { "string", "null" }) @Nullable String summary,
		@Schema(types = { "string", "null" }, description = "The text of the standard page.") @Nullable String about,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The cover, read at the public address of stored files.") @Nullable UUID coverFileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "upcoming", "open", "running", "done" },
				description = "Where the program stands now, worked out from its dates.") String phase,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate startsOn,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate endsOn,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "standard", "custom", "external" },
				description = "`standard` is built from these fields, `custom` is written in the web application for this address, `external` lives at `externalUrl`.") String pageKind,
		@Schema(types = { "string", "null" }, format = "uri") @Nullable String externalUrl,
		@Schema(description = "Null for a program that takes no applications here. Its opening, its closing and the day outcomes are due belong in the timeline beside the key dates.") @Nullable ProgramApplications applications,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "In the order the operator gave.") List<ProgramKeyDate> keyDates,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "In the order the operator gave.") List<ProgramEventEntry> events,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "draft", "published" },
				description = "`draft` only when an operator previews a program that is not public.") String status) {
}
