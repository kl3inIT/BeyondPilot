package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.core.io.InputStreamSource;

/**
 * An application to a program, submitted or still a draft, for matching to assess it with the proposals its
 * organization sent to the program's use cases (BEY-234). It is never sent to a browser as it is.
 * @param organizationId the organization it applies as; null for a draft that has none yet
 * @param solutionId the solution it applies with; null for a draft that has chosen none yet
 * @param status {@code submitted} or {@code draft}
 * @param version the number of the last submission; 0 for a draft never submitted
 * @param reviewStatus GenAI Fund's decision: {@code under_review}, {@code shortlisted} or {@code not_selected}
 * @param stamp when what an assessment reads last changed: the last submission, or the last save of a draft
 * @param sent what the last submission held; null for a draft, which is listed and not read
 */
public record ProgramSubmission(UUID id, UUID programId, @Nullable UUID organizationId, @Nullable UUID solutionId,
		String status, int version, String reviewStatus, Instant stamp, @Nullable Sent sent) {

	/** Whether it was submitted, so that what it holds is read. */
	public boolean submitted() {
		return sent != null;
	}

	/** What a submission held, as its applicant sent it. */
	public record Sent(Organization organization, Solution solution, @Nullable File deck,
			List<String> builtWith, @Nullable String traction, List<Answer> answers) {
	}

	public record Organization(String name, String type, @Nullable String country, @Nullable String teamSize,
			@Nullable String website, @Nullable String teamBackground) {
	}

	public record Solution(String name, @Nullable String summary, @Nullable String problemsSolved,
			@Nullable String maturity, @Nullable String demoUrl) {
	}

	/** An answer to a question of the program's form, by its label; a file question holds its file. */
	public record Answer(String question, String kind, String value, @Nullable File file) {
	}

	/** A file the submission holds, with its bytes. */
	public record File(UUID id, String name, InputStreamSource content) {
	}

}
