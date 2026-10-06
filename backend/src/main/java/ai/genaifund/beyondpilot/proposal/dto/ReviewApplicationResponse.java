package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ReviewApplication",
		description = "One application as its applicant submitted it last, with the caller's assessment and, for an operator, every score and the decisions.")
public record ReviewApplicationResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ReviewHeadResponse head,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The number of the version shown.") int version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant submittedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Submitted submitted,
		@Schema(types = { "string", "null" }, allowableValues = { "under_review", "shortlisted", "not_selected" },
				description = "GenAI Fund's decision; null for a judge.") @Nullable String reviewStatus,
		@Schema(types = { "object", "null" }) @Nullable Assessment mine,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Every other assessment, for an operator; empty for a judge.") List<Assessment> others,
		@Schema(types = { "number", "null" },
				description = "The mean of every judge's score, for an operator; null for a judge.") @Nullable Double average,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Submissions and, for an operator, decisions, the oldest first.") List<Event> history,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Its place among the program's submitted applications, from 1.") int position,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int total,
		@Schema(types = { "string", "null" }, format = "uuid") @Nullable UUID previousId,
		@Schema(types = { "string", "null" }, format = "uuid") @Nullable UUID nextId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The caller's own application, or their organization's, which they never score or decide.") boolean own) {

	@Schema(name = "SubmittedApplication", description = "What the applicant sent, as it was.")
	public record Submitted(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ContactDetails contact,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationType,
			@Schema(types = { "string", "null" }) @Nullable String country,
			@Schema(types = { "string", "null" }) @Nullable String teamSize,
			@Schema(types = { "string", "null" }) @Nullable String website,
			@Schema(types = { "string", "null" }) @Nullable String teamBackground,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String solutionName,
			@Schema(types = { "string", "null" }) @Nullable String summary,
			@Schema(types = { "string", "null" }) @Nullable String problemsSolved,
			@Schema(types = { "string", "null" }) @Nullable String maturity,
			@Schema(types = { "object", "null" }) @Nullable AttachedFileResponse deck,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> builtWith,
			@Schema(types = { "string", "null" }) @Nullable String traction,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Answer> answers) {
	}

	@Schema(name = "SubmittedAnswer")
	public record Answer(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID questionId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String label,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String kind,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String value,
			@Schema(types = { "object", "null" }) @Nullable AttachedFileResponse file) {
	}

	@Schema(name = "Assessment", description = "One person's assessment of the application.")
	public record Assessment(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String reviewer,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "operator", "reviewer" }) String role,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The score of each criterion, by its identifier; empty for a conflict.") Map<UUID, Integer> scores,
			@Schema(types = { "number", "null" }) @Nullable Double average,
			@Schema(types = { "string", "null" }) @Nullable String note,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean conflict,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The version it was made on; earlier than the application's when it was submitted again since.") int version,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant savedAt) {
	}

	@Schema(name = "ReviewEvent")
	public record Event(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "submitted", "decided" }) String kind,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant at,
			@Schema(types = { "integer", "null" }, description = "The version a submission made.") @Nullable Integer version,
			@Schema(types = { "string", "null" }, allowableValues = { "under_review", "shortlisted", "not_selected" }) @Nullable String decision,
			@Schema(types = { "string", "null" }) @Nullable String reason,
			@Schema(types = { "string", "null" }, description = "Who decided.") @Nullable String by) {
	}
}
