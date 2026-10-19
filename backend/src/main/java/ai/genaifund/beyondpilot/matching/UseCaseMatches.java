package ai.genaifund.beyondpilot.matching;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * The solutions matched to a use case as an operator sees them, for a module that shows them outside the admin screen:
 * what it asks for, its last run, and each candidate with its group, its findings and what people decided.
 * @param run the last run; null when the use case was never matched
 */
public record UseCaseMatches(UUID useCaseId, String title, @Nullable Run run, List<Requirement> requirements,
		List<Candidate> candidates) {

	/**
	 * The last run.
	 * @param state {@code queued}, {@code running}, {@code waiting}, {@code done} or {@code failed}
	 * @param failure why it failed or waits, as a code
	 * @param judged how many candidates are judged, of {@code total}
	 */
	public record Run(UUID id, String state, String origin, Instant createdAt, @Nullable Instant endedAt,
			@Nullable String failure, int judged, int total, @Nullable String modelName) {
	}

	/**
	 * One thing the use case asks for.
	 * @param position its place in the list, from 1; a finding names it by this
	 * @param kind {@code capability} or {@code constraint}
	 * @param necessity {@code required} or {@code optional}
	 * @param quote the words of the brief it comes from
	 */
	public record Requirement(int position, String kind, String necessity, String label, String statement,
			String quote) {
	}

	/**
	 * One solution for the use case.
	 * @param origin {@code recommended} by a run or {@code added} by GenAI Fund
	 * @param bucket {@code direct}, {@code industry}, {@code technology} or {@code none}
	 * @param decision what people last decided: {@code none}, {@code shortlisted} or {@code removed}
	 * @param summary the model's one sentence: the strongest reason, or what is missing
	 * @param unread which of its sources could not be read at all: deck, website
	 * @param findings one per requirement, in their order
	 * @param disagreeCount of the people who answered on its group, how many said it is wrong
	 */
	public record Candidate(UUID solutionId, String solutionName, @Nullable String organizationName, boolean listed,
			String origin, String bucket, int requiredMet, int requiredTotal, String decision,
			@Nullable String removedReason, @Nullable String removedNote, @Nullable String removedBy,
			@Nullable Instant invitedAt, boolean judged, @Nullable String summary, List<String> unread,
			List<Finding> findings, @Nullable Finding problem, @Nullable Finding industry,
			@Nullable Finding technology, @Nullable Integer feedbackCount, @Nullable Integer disagreeCount) {
	}

	/**
	 * What the solution's own material shows, with the words that show it.
	 * @param requirement the place of the requirement it answers; null for the problem, industry and technology
	 * @param status {@code met}, {@code partly} or {@code not_shown}
	 * @param quote words copied from the solution's material; empty when nothing shows it
	 * @param source where the quote is: profile, customer case 1, deck p.3, website 2
	 * @param quoteState where code found the quote: {@code exact}, {@code other_source}, {@code close},
	 * {@code not_found} or {@code none}
	 */
	public record Finding(@Nullable Integer requirement, String status, String quote, String source,
			@Nullable String sourceUrl, String reason, String quoteState) {
	}

}
