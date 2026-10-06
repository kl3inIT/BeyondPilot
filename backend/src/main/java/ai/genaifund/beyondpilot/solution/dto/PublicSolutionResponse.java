package ai.genaifund.beyondpilot.solution.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PublicSolution", description = "An approved solution as anyone with its address reads it, listed or not.")
public record PublicSolutionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of the organization's public page.") String organizationSlug,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Nullable String country,
		@Schema(types = { "string", "null" }) @Nullable String summary,
		@Schema(types = { "string", "null" }) @Nullable String problemsSolved,
		@Schema(types = { "string", "null" }) @Nullable String valueProposition,
		@Schema(types = { "string", "null" },
				allowableValues = { "idea", "prototype", "pilot", "production", "scaled" }) @Nullable String maturity,
		@Schema(types = { "string", "null" }) @Nullable String traction,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> builtWith,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> industries,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> focusAreas,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> languages,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> deployment,
		@Schema(types = { "string", "null" }) @Nullable String bestCustomerProfile,
		@Schema(types = { "string", "null" }) @Nullable String website,
		@Schema(types = { "string", "null" }) @Nullable String demoUrl,
		@Schema(types = { "object", "null" }, description = "Its deck, when it has one.") @Nullable PublicSolutionDeckResponse deck,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the directory lists it. False is approved but shared by its address only.") boolean listed,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Its approved customer deployments, the most recently approved first.") List<PublicCustomerDeploymentResponse> customerDeployments) {
}
