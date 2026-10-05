package ai.genaifund.beyondpilot.solution.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PublicSolution", description = "An approved, listed solution as anyone reads it.")
public record PublicSolutionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of the organization's public page.") String organizationSlug,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Nullable String country,
		@Schema(types = { "string", "null" }) @Nullable String summary,
		@Schema(types = { "string", "null" }) @Nullable String problemsSolved,
		@Schema(types = { "string", "null" }) @Nullable String valueProposition,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> focusAreas,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> industries,
		@Schema(types = { "string", "null" },
				allowableValues = { "idea", "prototype", "pilot", "production", "scaled" }) @Nullable String maturity,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> deployment,
		@Schema(types = { "string", "null" }) @Nullable String website,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Its approved customer deployments, the most recently approved first.") List<PublicCustomerDeploymentResponse> customerDeployments) {
}
