package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One application as its applicant submitted it last, with every assessment, for a module that reports it to an
 * operator: the MCP server's {@code get_application}.
 * @param decision GenAI Fund's decision: {@code under_review}, {@code shortlisted} or {@code not_selected}
 * @param averageScore the mean of every judge's score; null until one scores it
 * @param criteria what the program's judges score, in order
 */
public record SubmittedApplication(UUID id, Program program, int version, Instant submittedAt,
		@Nullable String decision, @Nullable Double averageScore, Applicant applicant, Organization organization,
		Solution solution, List<Answer> answers, List<Criterion> criteria, List<Assessment> assessments) {

	public record Program(UUID id, String slug, String name) {
	}

	public record Applicant(String email, @Nullable String firstName, @Nullable String lastName,
			@Nullable String phone, @Nullable String country, @Nullable String linkedin) {
	}

	public record Organization(String name, String type, @Nullable String country, @Nullable String teamSize,
			@Nullable String website, @Nullable String teamBackground) {
	}

	public record Solution(String name, @Nullable String summary, @Nullable String problemsSolved,
			@Nullable String maturity, @Nullable String demoUrl, List<String> builtWith, @Nullable String traction,
			@Nullable File deck) {
	}

	/** An answer to a question of the program's form; a file question holds its file. */
	public record Answer(String question, String kind, String value, @Nullable File file) {
	}

	/** A PDF the application holds. */
	public record File(UUID id, String name, long sizeBytes) {
	}

	public record Criterion(UUID id, String name, @Nullable String description) {
	}

	/**
	 * One person's assessment.
	 * @param role {@code operator} or {@code reviewer}
	 * @param scores the score of each criterion from 1 to 5, by its identifier; empty for a conflict
	 * @param version the version it was made on; earlier than the application's when it was submitted again since
	 */
	public record Assessment(String reviewer, String role, Map<UUID, Integer> scores, @Nullable Double average,
			@Nullable String note, boolean conflict, int version) {
	}

}
