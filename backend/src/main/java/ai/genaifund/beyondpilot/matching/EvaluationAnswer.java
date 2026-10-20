package ai.genaifund.beyondpilot.matching;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import org.jspecify.annotations.Nullable;

/**
 * What the model answers for one candidate of a program's evaluation (BEY-234), after Kai's methodology. Every field may
 * be missing in an answer, and code refuses an answer that misses one it needs. The fields are in the order the model
 * is asked to fill them: the evidence first, then what it makes of it, so the tier comes last (a plain model judging
 * startups leans optimistic; arXiv 2405.19456).
 * @param criteria the six criteria, each with its findings
 * @param alignment how the candidate connects to the use cases, apart from how strong a supplier it is
 * @param gate whether the proposal is specific to the use case, and the early-stage route
 * @param tier {@code strong_match}, {@code potential_match}, {@code to_consider} or {@code strong_no}
 * @param provisional whether the tier waits on a demonstration or a clarification not seen yet
 * @param why one short sentence: why consider it
 * @param concern one short sentence: the main gap
 * @param next one short sentence: the specific validation to ask for
 * @param rationale a few sentences on the tier
 * @param contradictions material statements that conflict, each with both sources
 * @param questions what to ask the candidate, the most useful first
 * @param instructionsInSources whether a source held words addressed to the model, such as asking for a tier
 */
@JsonPropertyOrder({ "criteria", "alignment", "gate", "tier", "provisional", "why", "concern", "next", "rationale",
		"contradictions", "questions", "instructionsInSources" })
record EvaluationAnswer(@Nullable List<Criterion> criteria, @Nullable Alignment alignment, @Nullable Gate gate,
		@Nullable String tier, @Nullable Boolean provisional, @Nullable String why, @Nullable String concern,
		@Nullable String next, @Nullable String rationale, @Nullable List<String> contradictions,
		@Nullable List<String> questions, @Nullable Boolean instructionsInSources) {

	/**
	 * One criterion and what was found for it.
	 * @param key {@code team}, {@code traction}, {@code readiness}, {@code product}, {@code funding} or
	 * {@code proposal}
	 * @param tractionKind for traction only: {@code same_use_case}, {@code adjacent_product}, {@code active_pilot},
	 * {@code prototype_only} or {@code not_substantiated}
	 */
	@JsonPropertyOrder({ "key", "findings", "tractionKind" })
	record Criterion(@Nullable String key, @Nullable List<Finding> findings, @Nullable String tractionKind) {
	}

	/**
	 * One finding, the evidence before the label.
	 * @param quote the words of a source that support it, copied; empty when nothing was disclosed
	 * @param source the label of that source
	 * @param finding what the material shows, in a sentence or two
	 * @param gap what is still missing or must be checked
	 * @param label {@code documented}, {@code claimed}, {@code not_disclosed} or {@code contradictory}
	 * @param summary a short line for the list: about ten words
	 */
	@JsonPropertyOrder({ "quote", "source", "finding", "gap", "label", "summary" })
	record Finding(@Nullable String quote, @Nullable String source, @Nullable String finding, @Nullable String gap,
			@Nullable String label, @Nullable String summary) {
	}

	/**
	 * @param category {@code direct}, {@code industry}, {@code technology} or {@code none}
	 * @param reason one sentence on the connection to the use case
	 */
	@JsonPropertyOrder({ "reason", "category" })
	record Alignment(@Nullable String reason, @Nullable String category) {
	}

	/**
	 * @param reason one sentence on whether the proposal explains how it answers this use case
	 * @param proposal {@code passed} or {@code failed}
	 * @param earlyStage {@code not_needed}, {@code team}, {@code prototype} or {@code not_substantiated}
	 */
	@JsonPropertyOrder({ "reason", "proposal", "earlyStage" })
	record Gate(@Nullable String reason, @Nullable String proposal, @Nullable String earlyStage) {
	}

}
