package ai.genaifund.beyondpilot.solution.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveSolution", description = "A solution as its editor holds it, in the order of its steps.")
public record SaveSolutionRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String name,
		@Schema(types = { "string", "null" },
				description = "Two or three sentences shown in lists.") @Size(max = 600) @Nullable String summary,
		@Schema(types = { "string", "null" }) @Size(max = 4000) @Nullable String problemsSolved,
		@Schema(types = { "string", "null" }) @Size(max = 4000) @Nullable String valueProposition,
		@Schema(types = { "string", "null" },
				allowableValues = { "idea", "prototype", "pilot", "production", "scaled" }) @Pattern(
						regexp = SolutionCodes.MATURITY) @Nullable String maturity,
		@Schema(types = { "string", "null" },
				description = "Customers, pilots, users or revenue so far.") @Size(max = 600) @Nullable String traction,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The models, tools and frameworks it is built with, as its owners name them.") @NotNull @Size(
						max = 10) List<@NotBlank @Size(max = 40) String> builtWith,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 5) List<@NotNull @Pattern(regexp = SolutionCodes.INDUSTRY) String> industries,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 5) List<@NotNull @Pattern(regexp = SolutionCodes.FOCUS_AREA) String> focusAreas,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The languages it works in.") @NotNull @Size(
				max = 10) List<@NotNull @Pattern(regexp = SolutionCodes.LANGUAGE) String> languages,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 4) List<@NotNull @Pattern(regexp = SolutionCodes.DEPLOYMENT) String> deployment,
		@Schema(types = { "string", "null" },
				description = "The channels it works through, such as voice and chat.") @Size(max = 120) @Nullable String channels,
		@Schema(types = { "string", "null" }, description = "Who gets the most from it, in a sentence.") @Size(
				max = 400) @Nullable String bestCustomerProfile,
		@Schema(types = { "string", "null" }) @Size(max = 300) @Pattern(
				regexp = SolutionCodes.WEBSITE) @Nullable String website,
		@Schema(types = { "string", "null" }, description = "A video or a live demo of the solution at work.") @Size(
				max = 300) @Pattern(regexp = SolutionCodes.WEBSITE) @Nullable String demoUrl,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The stored PDF that is its deck: the one it has, one the caller uploaded for it, or "
						+ "null for none.") @Nullable UUID deckFileId,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The stored image that is its logo: the one it has, one the caller uploaded for it, or "
						+ "null for none.") @Nullable UUID logoFileId,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The stored image that is its cover, named in the same way.") @Nullable UUID coverFileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The stored images shown under the cover, in their order: those it has and those "
						+ "the caller uploaded for it.") @NotNull @Size(max = 4) List<@NotNull UUID> imageFileIds,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it appears in the public directory once approved.") @NotNull Boolean listed,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The version the screen read.") @NotNull Long version) {
}
