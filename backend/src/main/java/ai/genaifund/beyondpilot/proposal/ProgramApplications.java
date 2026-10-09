package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A program's submitted applications as an operator reviews them, for a module that reports them: the MCP server's
 * {@code list_applications}.
 * @param drafts applications started and never submitted
 * @param withdrawn applications their applicants withdrew
 */
public record ProgramApplications(long drafts, long withdrawn, List<Application> applications) {

	/**
	 * One submitted application.
	 * @param decision GenAI Fund's decision: {@code under_review}, {@code shortlisted} or {@code not_selected}
	 * @param averageScore the mean of every judge's score; null until one scores it
	 * @param scored how many judges scored it
	 */
	public record Application(UUID id, String solutionName, String organizationName, String organizationType,
			@Nullable String country, Instant submittedAt, int version, @Nullable String decision,
			@Nullable Double averageScore, int scored) {
	}

}
