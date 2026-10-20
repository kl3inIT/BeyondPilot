package ai.genaifund.beyondpilot.matching.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProposalEvaluations",
		description = "The proposals a use case holds now, each set against the use case's requirements by the AI, with the words that show it.")
public record ProposalEvaluationsResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID useCaseId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether an AI model is set for matching; without one no proposal is read.") boolean modelChosen,
		@Schema(description = "The last run of matching for the use case; absent when there was none.") MatchingResponse.@Nullable Run run,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What the use case asks for, as the last run read it, capabilities first.") List<MatchingResponse.Requirement> requirements,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "One for each proposal sent to the use case and not withdrawn, the latest first.") List<Evaluation> proposals) {

	@Schema(name = "ProposalEvaluation", description = "What the AI found in one proposal, requirement by requirement.")
	public record Evaluation(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID proposalId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "`judged`: the evaluation is of the proposal as it is. `outdated`: it is of the proposal before its last edit, and a run will read it again. `waiting`: no run has read it yet.",
					allowableValues = { "judged", "outdated", "waiting" }) String state,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The names of the solutions it offers, in its order: a source `solution 2 deck p.4` is the second.") List<String> solutionNames,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "How many required capabilities it meets; 0 while waiting.") int requiredMet,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "How many required capabilities the use case has; 0 while waiting.") int requiredTotal,
			@Schema(description = "The AI's one sentence: the strongest reason it fits, or the main thing missing.") @Nullable String summary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Sources that could not be read at all: `proposal_deck`, the proposal's PDF.") List<String> unread,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "One per requirement, in their order; empty while waiting. A source is `proposal`, `team`, `proposal deck p.3`, or a solution's own source after its place, such as `solution 1 profile`, `solution 1 deck p.2`, `solution 1 website 3`, `solution 1 customer case 1`.") List<MatchingResponse.Finding> findings,
			@Schema(description = "Whether the proposal is made for the job the use case's problem describes; absent while waiting.") MatchingResponse.@Nullable Finding problem,
			@Schema(description = "When the evaluation kept was made; absent while waiting.") @Nullable Instant judgedAt) {
	}

}
