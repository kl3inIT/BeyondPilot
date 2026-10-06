package ai.genaifund.beyondpilot.search.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SearchItem", description = "One result, as its card shows it. Members of another kind are null or empty.")
public record SearchItem(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "program", "solution", "talent", "use_case" }) String kind,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of its page under the path of its kind; a use case's identifier.") String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(types = { "string", "null" },
				description = "The partner of a program, the organization of a solution, the headline of a person, the organization of a use case unless it stays anonymous.") @Nullable String subtitle,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "A program's or a solution's summary, a person's bio, a use case's problem.") String summary,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The summary, or a person's headline, with each word the query matched between U+0002 and U+0003, to be shown in bold.") String snippet,
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
		@Schema(types = { "integer", "null" }, format = "int32",
				description = "How many of a solution's customer deployments GenAI Fund approved.") @Nullable Integer customerDeployments,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The industries of a solution, a person or a use case.") List<String> industries,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "A solution's focus areas.") List<String> focusAreas,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "A person's roles.") List<String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "A person's skills.") List<String> skills,
		@Schema(types = { "string", "null" }, description = "A person's city.") @Nullable String city,
		@Schema(types = { "string", "null" }, description = "Where a person works.") @Nullable String worksAt,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "A person's photo, read at the public address of stored files.") @Nullable UUID photoFileId,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When a use case stops taking proposals.") @Nullable Instant closesAt,
		@Schema(types = { "integer", "null" }, format = "int32",
				description = "A use case's budget, when its organization shows it.") @Nullable Integer budgetMin,
		@Schema(types = { "integer", "null" }, format = "int32",
				description = "A use case's budget, when its organization shows it.") @Nullable Integer budgetMax,
		@Schema(types = { "boolean", "null" },
				description = "Whether a use case's budget is still to be determined.") @Nullable Boolean budgetToBeDetermined) {
}
