package ai.genaifund.beyondpilot.matching.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "MatchingRunDetail",
		description = "One run in detail: what it cost, its steps, and which solutions changed group since the run of the same use case before it.")
public record MatchingRunResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) MatchingRunSummary run,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "What it did in each step, in order.") List<Step> steps,
		@Schema(types = { "string", "null" },
				description = "The run of the same use case before it; null for its first.") @Nullable UUID previousRunId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether both runs kept the group of each solution, so that they can be compared; false for a first run and for one before the groups were kept.") boolean compared,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many solutions each group held in the run before and in this one; empty when not compared.") List<Group> groups,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The solutions whose group changed, entered or left; empty when not compared.") List<Move> moves) {

	@Schema(name = "MatchingRunStep", description = "What a run did in one step.")
	public record Step(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "requirements", "candidates", "judgment" }) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many the step was given.") int takenIn,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many it produced.") int givenOut,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int calls,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long inputTokens,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long outputTokens,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long millis) {
	}

	@Schema(name = "MatchingRunGroup", description = "How many solutions a group held in two runs.")
	public record Group(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "direct", "industry", "technology", "none" }) String bucket,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int before,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int after) {
	}

	@Schema(name = "MatchingRunMove", description = "A solution whose group differs between two runs.")
	public record Move(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID solutionId,
			@Schema(types = { "string", "null" },
					description = "The name of the solution; null when it is no longer shown anywhere.") @Nullable String solutionName,
			@Schema(types = { "string", "null" }, description = "Its group in the run before; null when it was not in it.",
					allowableValues = { "direct", "industry", "technology", "none" }) @Nullable String before,
			@Schema(types = { "string", "null" }, description = "Its group in this run; null when it left.",
					allowableValues = { "direct", "industry", "technology", "none" }) @Nullable String after) {
	}

}
