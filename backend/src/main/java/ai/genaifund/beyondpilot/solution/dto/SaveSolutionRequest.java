package ai.genaifund.beyondpilot.solution.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveSolution", description = "A solution as its edit screen holds it.")
public record SaveSolutionRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String name,
		@Schema(types = { "string", "null" },
				description = "One or two sentences shown in lists.") @Size(max = 300) @Nullable String summary,
		@Schema(types = { "string", "null" }) @Size(max = 4000) @Nullable String problemsSolved,
		@Schema(types = { "string", "null" }) @Size(max = 4000) @Nullable String valueProposition,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 5) List<@NotNull @Pattern(regexp = SolutionCodes.FOCUS_AREA) String> focusAreas,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 5) List<@NotNull @Pattern(regexp = SolutionCodes.INDUSTRY) String> industries,
		@Schema(types = { "string", "null" },
				allowableValues = { "idea", "prototype", "pilot", "production", "scaled" }) @Pattern(
						regexp = SolutionCodes.MATURITY) @Nullable String maturity,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 4) List<@NotNull @Pattern(regexp = SolutionCodes.DEPLOYMENT) String> deployment,
		@Schema(types = { "string", "null" }) @Size(max = 300) @Pattern(
				regexp = SolutionCodes.WEBSITE) @Nullable String website,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The deck: a PDF the caller uploaded for `application_file`. Private.") @Nullable UUID deckFileId,
		@Schema(types = { "string", "null" }, description = "A video, a prototype or a live demo.") @Size(
				max = 300) @Pattern(regexp = SolutionCodes.WEBSITE) @Nullable String demoUrl,
		@Schema(types = { "array", "null" },
				description = "The models, tools and frameworks it is built with; null names none.") @Size(
						max = 10) @Nullable List<@NotBlank @Size(max = 60) String> builtWith,
		@Schema(types = { "string", "null" },
				description = "Customers, pilots, users or revenue so far.") @Size(max = 600) @Nullable String traction,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it appears in the public directory once approved.") @NotNull Boolean listed,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The version the screen read.") @NotNull Long version) {
}
