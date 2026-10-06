package ai.genaifund.beyondpilot.search.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SearchItem", description = "One result, as its card shows it. Members of another kind are null or empty.")
public record SearchItem(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "program", "solution", "talent" }) String kind,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of its page under the path of its kind.") String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(types = { "string", "null" },
				description = "The partner of a program, the organization of a solution, the headline of a person.") @Nullable String subtitle,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "A program's or a solution's summary, a person's bio.") String summary,
		@Schema(types = { "string", "null" }, description = "A program's type.") @Nullable String type,
		@Schema(types = { "string", "null" }, allowableValues = { "upcoming", "open", "running", "done" },
				description = "Where a program stands now.") @Nullable String phase,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate startsOn,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate endsOn,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "A program's cover, read at the public address of stored files.") @Nullable UUID coverFileId,
		@Schema(types = { "string", "null" }, format = "uri",
				description = "Where a program's page is when it has none here.") @Nullable String externalUrl,
		@Schema(types = { "string", "null" },
				description = "The address of the page of a solution's organization.") @Nullable String organizationSlug,
		@Schema(types = { "string", "null" },
				description = "The country of a solution's organization, or of a person.") @Nullable String country,
		@Schema(types = { "string", "null" }, description = "A solution's maturity.") @Nullable String maturity,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "A solution's industries.") List<String> industries,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "A solution's focus areas.") List<String> focusAreas,
		@Schema(types = { "string", "null" }, description = "A person's availability.") @Nullable String availability,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "A person's roles.") List<String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "A person's skills.") List<String> skills) {
}
