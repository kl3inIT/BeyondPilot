package ai.genaifund.beyondpilot.program.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminProgram", description = "A program as an operator edits it, in any status.")
public record AdminProgramResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The address under /programs.") String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "enterprise_challenge", "open_innovation_call", "accelerator", "hackathon",
						"buildathon", "grant", "venture_building", "pitch_competition", "event_series",
						"event" }) String type,
		@Schema(types = { "string", "null" },
				description = "The organization the program is run with.") @Nullable String partnerName,
		@Schema(types = { "string", "null" },
				description = "One or two sentences, shown on the list.") @Nullable String summary,
		@Schema(types = { "string", "null" }, description = "The text of the standard page.") @Nullable String about,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate startsOn,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate endsOn,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "draft", "published" },
				description = "Only a published program is public.") String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "standard", "custom", "external" },
				description = "`standard` is built from these fields, `custom` is written in the web application for this address, `external` links to `externalUrl`.") String pageKind,
		@Schema(types = { "string", "null" }, format = "uri") @Nullable String externalUrl,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Sent back with a save, which is refused when someone else saved in the meantime.") long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt) {
}
