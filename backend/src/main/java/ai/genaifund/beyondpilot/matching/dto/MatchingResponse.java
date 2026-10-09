package ai.genaifund.beyondpilot.matching.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Matching",
		description = "The solutions matched to a use case: what it asks for, its last run and its candidates.")
public record MatchingResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID useCaseId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the caller is an operator: operators add candidates, judge all again and see the steps.") boolean operator,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether an AI model is set for matching; without one no run starts.") boolean modelChosen,
		@Schema(description = "How many more runs the caller may start today; absent for operators, who have no limit.") @Nullable Integer runsLeftToday,
		@Schema(description = "The last run; absent when the use case was never matched.") @Nullable Run run,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What the use case asks for, as the last run read it, capabilities first.") List<Requirement> requirements,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The candidates, in the order the last run found them.") List<Candidate> candidates,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What the last run did in each step; empty for a caller who is not an operator.") List<Step> steps) {

	@Schema(name = "MatchingRun", description = "One pass of matching for a use case.")
	public record Run(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "queued", "running", "waiting", "done", "failed" }) String state,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "What started it: a change of the use case, an operator or a member.",
					allowableValues = { "approved", "operator", "member" }) String origin,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
			@Schema(description = "When it starts, while it waits for the use case to stay unchanged.") @Nullable Instant startsAt,
			@Nullable Instant startedAt, @Nullable Instant endedAt,
			@Schema(description = "When it goes on, while it waits for the AI provider.") @Nullable Instant resumesAt,
			@Schema(description = "Why it failed or waits, as a code; never the provider's words.") @Nullable String failure,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many candidates are judged.") int judged,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many candidates there are.") int total,
			@Schema(description = "The model that judged; absent for a caller who is not an operator.") @Nullable String modelName) {
	}

	@Schema(name = "MatchingRequirement", description = "One thing the use case asks for.")
	public record Requirement(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Its place in the list, from 1; a finding names it by this.") int position,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "A capability is what the product does; a constraint is a condition of delivery.",
					allowableValues = { "capability", "constraint" }) String kind,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "required", "optional" }) String necessity,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String statement,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The words of the brief it comes from.") String quote) {
	}

	@Schema(name = "MatchingCandidate", description = "One solution for the use case, with what was found and decided.")
	public record Candidate(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID solutionId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The address of the solution in the directory.") String solutionSlug,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String solutionName,
			@Nullable String organizationName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "False when its owners keep it out of the directory: it has no public page.") boolean listed,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Found by a run, or added by GenAI Fund.",
					allowableValues = { "recommended", "added" }) String origin,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "direct", "industry", "technology", "none" }) String bucket,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int requiredMet,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int requiredTotal,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "What people last decided.",
					allowableValues = { "none", "shortlisted", "removed" }) String decision,
			@Schema(description = "Why it was removed.",
					allowableValues = { "not_relevant", "already_known", "not_credible", "other" }) @Nullable String removedReason,
			@Nullable String removedNote,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Whether a run judged it; one added by hand waits for the next run.") boolean judged,
			@Schema(description = "The model's one sentence: the strongest reason, or what is missing.") @Nullable String summary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Which of its sources held no text to read.",
					allowableValues = { "deck", "website" }) List<String> unread,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "One finding per requirement, in their order.") List<Finding> findings,
			@Schema(description = "Whether the product is made for the problem.") @Nullable Finding problem,
			@Schema(description = "Whether the vendor delivered a similar workflow in the use case's industry.") @Nullable Finding industry,
			@Schema(description = "Whether the product is built on the technologies the use case names.") @Nullable Finding technology) {
	}

	@Schema(name = "MatchingFinding", description = "What the solution's own material shows, with the words that show it.")
	public record Finding(
			@Schema(description = "The place of the requirement it answers; absent for the problem, industry and technology.") @Nullable Integer requirement,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "met", "partly", "not_shown" }) String status,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Words copied from the solution's material; empty when nothing shows it.") String quote,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Where the quote is: profile, customer case 1, deck p.3, website 2.") String source,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The model's one sentence on what the quote shows.") String reason,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Where code found the quote.",
					allowableValues = { "exact", "other_source", "close", "not_found", "none" }) String quoteState) {
	}

	@Schema(name = "MatchingStep", description = "What a run did in one step.")
	public record Step(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "requirements", "candidates", "judgment" }) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int takenIn,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int givenOut,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int calls,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long inputTokens,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long outputTokens,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long millis) {
	}

}
