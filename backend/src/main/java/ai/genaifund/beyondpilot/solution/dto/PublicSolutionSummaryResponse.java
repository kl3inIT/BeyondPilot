package ai.genaifund.beyondpilot.solution.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PublicSolutionSummary", description = "One solution in the public directory.")
public record PublicSolutionSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of the organization's public page.") String organizationSlug,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Nullable String country,
		@Schema(types = { "string", "null" }) @Nullable String summary,
		@Schema(types = { "string", "null" },
				allowableValues = { "idea", "prototype", "pilot", "production", "scaled" }) @Nullable String maturity,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> focusAreas,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> industries,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "Its logo, read at /api/storage/files/{id}; null for none.") @Nullable UUID logoFileId,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "Its cover, read at /api/storage/files/{id}; null for none.") @Nullable UUID coverFileId,
		@Schema(types = { "string", "null" },
				description = "What GenAI Fund says of it in a line: the programme it was selected for, or else who "
						+ "backs its company. Null when it has said neither.") @Nullable String backing,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many approved customer deployments it lists.") int customerDeployments) {
}
