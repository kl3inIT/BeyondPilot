package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A program's submitted applications as an operator reviews them, for a module that reports them: the MCP server's
 * {@code list_applications}.
 * @param challengeArea the program's first one-choice question, which the admin list shows and filters by; null when
 * it asks none
 * @param drafts applications started and never submitted
 * @param withdrawn applications their applicants withdrew
 */
public record ProgramApplications(@Nullable ChallengeArea challengeArea, long drafts, long withdrawn,
		List<Application> applications) {

	/** The question whose answer sorts applications into areas, and the options it offers. */
	public record ChallengeArea(String question, List<String> options) {
	}

	/**
	 * One submitted application.
	 * @param challengeArea its answer to the program's challenge-area question
	 * @param decision GenAI Fund's decision: {@code under_review}, {@code shortlisted} or {@code not_selected}
	 * @param averageScore the mean of every judge's score; null until one scores it
	 * @param scored how many judges scored it
	 */
	public record Application(UUID id, String solutionName, String organizationName, String organizationType,
			@Nullable String country, @Nullable String email, @Nullable String challengeArea, Instant submittedAt,
			int version, @Nullable String decision, @Nullable Double averageScore, int scored) {
	}

}
