package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * How a program's applications are reviewed, for a module that reports it to an operator: the MCP server's
 * {@code get_program}. Its criteria, its judges and where its outcomes stand; reading it releases nothing.
 * @param criteriaFixed an application has been scored on the criteria, which fixes them
 * @param releasedAt when the outcomes were released; null until then
 * @param readyToRelease applications have closed, every one has a decision, and nothing was released yet
 */
public record ProgramReview(List<Criterion> criteria, boolean criteriaFixed, List<Judge> judges, long drafts,
		long withdrawn, @Nullable Instant releasedAt, boolean readyToRelease, List<Outcome> shortlisted,
		List<Outcome> notSelected, List<Outcome> undecided) {

	/**
	 * One thing the applications are judged on, scored from 1 to 10.
	 * @param maxPoints its weight; null when the criteria have no points
	 */
	public record Criterion(String name, @Nullable String description, @Nullable Integer maxPoints) {
	}

	/**
	 * Someone who scores the applications: a judge GenAI Fund invited, or an operator who scored one.
	 * @param role {@code reviewer} or {@code operator}
	 * @param status {@code active}, {@code invited} or {@code lapsed}
	 * @param assessed how many submitted applications they scored or stepped back from
	 */
	public record Judge(String email, @Nullable String name, String role, String status, @Nullable Instant invitedAt,
			long assessed) {
	}

	/** A submitted application with GenAI Fund's decision on it. */
	public record Outcome(UUID id, String solutionName, String organizationName, @Nullable Double averageScore) {
	}

}
