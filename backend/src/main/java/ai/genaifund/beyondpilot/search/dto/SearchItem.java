package ai.genaifund.beyondpilot.search.dto;

import java.time.LocalDate;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SearchItem", description = "One result, as its card shows it.")
public record SearchItem(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "program", "solution", "talent" }) String kind,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of its page under the path of its kind.") String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(types = { "string", "null" },
				description = "The partner of a program, the organization of a solution, the headline of a person.") @Nullable String subtitle,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String summary,
		@Schema(types = { "string", "null" }, description = "A program's type; null for other kinds.") @Nullable String type,
		@Schema(types = { "string", "null" }, allowableValues = { "upcoming", "open", "running", "done" },
				description = "Where a program stands now; null for other kinds.") @Nullable String phase,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate startsOn,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate endsOn,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The cover, read at the public address of stored files.") @Nullable UUID coverFileId,
		@Schema(types = { "string", "null" }, format = "uri",
				description = "Where a program's page is when it has none here.") @Nullable String externalUrl) {
}
