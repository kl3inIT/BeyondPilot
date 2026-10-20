package ai.genaifund.beyondpilot.matching.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EvaluationBoard",
		description = "Every submission to a program, grouped as candidates, with the shortlist tier the AI suggests and the evidence behind it. The AI never decides: decisions stay on the applications and the proposals.")
public record EvaluationBoardResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID programId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether an AI model is set for evaluation; without one nothing is assessed.") boolean modelChosen,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The program's approved use cases the candidates are assessed against; empty when it has none, and then nothing is assessed.") List<UseCase> useCases,
		@Schema(description = "The program's last evaluation run; absent when there was none.") @Nullable Run run,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "One per organization and solution, whichever routes it used, the latest assessed first.") List<Candidate> candidates) {

	@Schema(name = "EvaluationUseCase")
	public record UseCase(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title) {
	}

	@Schema(name = "EvaluationRun", description = "A run of the program's evaluation and how far it got.")
	public record Run(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "queued", "running", "waiting", "done", "failed" }) String state,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "`change`: a submission or a use case changed. `operator`: someone started it.",
					allowableValues = { "change", "operator" }) String origin,
			@Schema(description = "The model that assessed, as its provider names it.") @Nullable String modelName,
			@Schema(description = "Why it failed or waits: `no_use_case`, `no_model`, `request_refused`, or the kind of error. Never a provider's message.") @Nullable String failure,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Candidates assessed or found unchanged in this pass.") int assessed,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Candidates the pass gathered.") int total,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt, @Nullable Instant startedAt,
			@Nullable Instant endedAt,
			@Schema(description = "A run a change queued starts only once the program stays unchanged until then.") @Nullable Instant notBefore,
			@Schema(description = "When a run that waits after a refusal goes on.") @Nullable Instant resumeAt) {
	}

	@Schema(name = "EvaluationCandidate", description = "An organization with one solution, and its current assessment.")
	public record Candidate(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID organizationId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID solutionId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String solutionName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "`assessed`: of what it holds now. `outdated`: of what it held before a change, and the next run reads it again. `waiting`: not assessed yet.",
					allowableValues = { "assessed", "outdated", "waiting" }) String state,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Its application to the program and its proposals to the program's use cases, each with its own status and decision; a draft is listed and not read.") List<Record> records,
			@Schema(description = "The current assessment; absent while waiting.") @Nullable Assessment assessment) {
	}

	@Schema(name = "EvaluationRecord", description = "An application or a proposal a candidate sent.")
	public record Record(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "application", "proposal" }) String kind,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "An application: `submitted` or `draft`. A proposal: `sent`.",
					allowableValues = { "submitted", "draft", "sent" }) String status,
			@Schema(description = "An application: `under_review`, `shortlisted` or `not_selected`. A proposal: `shortlisted` or `declined`; absent while undecided.") @Nullable String decision,
			@Schema(description = "The use case a proposal was sent to.") @Nullable UUID useCaseId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "An application's last submission; 0 for a proposal or a draft never submitted.") int version,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "When what it holds last changed.") Instant changedAt) {
	}

	@Schema(name = "EvaluationAssessment", description = "What the AI suggests for a candidate, and the evidence.")
	public record Assessment(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "strong_match", "potential_match", "to_consider", "strong_no" }) String tier,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The tier waits on a demonstration or a clarification not seen yet.") boolean provisional,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "How it connects to the use cases, apart from how strong a supplier it is.",
					allowableValues = { "direct", "industry", "technology", "none" }) String alignment,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String alignmentReason,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Gate gate,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The six criteria in their order: team, traction, readiness, product, funding, proposal.") List<Criterion> criteria,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Notes notes,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Each record and file read: pages read of pages held, pages that held no text.") List<Coverage> coverage,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The AI said a source addressed it, such as asking for a tier; the assessment ignores it.") boolean instructionsInSources,
			@Schema(description = "Why the tier differs from the candidate's previous one.") @Nullable String changeNote,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String modelName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant assessedAt) {
	}

	@Schema(name = "EvaluationGate")
	public record Gate(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Whether the proposal is specific to the use case.",
					allowableValues = { "passed", "failed" }) String proposal,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "What carries a candidate without product traction.",
					allowableValues = { "not_needed", "team", "prototype", "not_substantiated" }) String earlyStage,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String reason) {
	}

	@Schema(name = "EvaluationCriterion")
	public record Criterion(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "team", "traction", "readiness", "product", "funding", "proposal" }) String key,
			@Schema(description = "For traction only.",
					allowableValues = { "same_use_case", "adjacent_product", "active_pilot", "prototype_only",
							"not_substantiated" }) @Nullable String tractionKind,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Finding> findings) {
	}

	@Schema(name = "EvaluationFinding")
	public record Finding(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "documented", "claimed", "not_disclosed", "contradictory" }) String label,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "About ten words, for a list.") String summary,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String finding,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "What is missing or must be checked; empty when nothing is.") String gap,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The label of the source quoted: `form: <question>`, `application deck p.3`, `application file 1 p.2`, `proposal 1`, `proposal 1 team`, `proposal 1 p.4`, `solution profile`, `solution deck p.2`, `solution website 1`; empty when nothing was quoted.") String source,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String quote,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Where code found the quote in what was read.",
					allowableValues = { "exact", "other_source", "close", "not_found", "none" }) String quoteState,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The AI labelled it Documented and code made it Claimed: its quote is not in what was read.") boolean lowered) {
	}

	@Schema(name = "EvaluationNotes")
	public record Notes(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String why,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String concern,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String next,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String rationale,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> contradictions,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "What to ask the candidate, the most useful first.") List<String> questions) {
	}

	@Schema(name = "EvaluationCoverage")
	public record Coverage(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "application", "proposal" }) String record,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The application or the proposal.") UUID recordId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The label its pages were read under, or what was read of a record without a file.") String label,
			@Schema(description = "The file read, which the record's file request opens.") @Nullable UUID fileId,
			@Schema(description = "The file's name.") @Nullable String file,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Pages the file has; 41 stands for more than the 40 read.") int pages,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int read,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Pages that held no text, even read from their picture.") List<Integer> unread,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Pages were left out at the limits.") boolean cut,
			@Schema(description = "The label of the file it repeats, read in its place, or why it could not be opened.") @Nullable String note) {
	}

}
