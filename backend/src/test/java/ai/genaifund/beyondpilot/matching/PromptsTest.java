package ai.genaifund.beyondpilot.matching;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Requirement;
import ai.genaifund.beyondpilot.usecase.UseCaseBrief;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What a run's judgments share goes in their instructions, and only a candidate's own sources in its message, so that
 * the provider can cache the part every call of the run starts with.
 */
class PromptsTest {

	private static final UseCaseBrief BRIEF = new UseCaseBrief(UUID.randomUUID(), UUID.randomUUID(), "Claims triage",
			"Insurance", List.of("OCR"), "Claim forms are typed in by hand.", "Faster payouts.", null, null, null, null,
			null, List.of(), List.of());

	private static final List<Requirement> REQUIREMENTS = List.of(new Requirement(1, MatchingRepository.CAPABILITY,
			MatchingRepository.REQUIRED, "Reads claim forms and takes out their fields.", "typed in by hand",
			"Read forms"));

	@Test
	void theInstructionsCarryTheUseCaseAndItsRequirementsAfterTheRules() {
		String instructions = Prompts.judging(BRIEF, REQUIREMENTS);

		assertThat(instructions).startsWith(Prompts.JUDGMENT);
		assertThat(instructions).contains("USE CASE: Claims triage", "Industry: Insurance", "Technologies named: OCR",
				"Problem: Claim forms are typed in by hand. Faster payouts.",
				"R1 (capability, required): Reads claim forms and takes out their fields.");
		assertThat(instructions).doesNotContain("PRODUCT SOURCES");
	}

	@Test
	void aCandidatesMessageHoldsItsSourcesAloneAndAsksTheQuestionLast() {
		String message = Prompts.candidate(Map.of("deck p.1", "We read claim forms in Vietnamese."));

		assertThat(message).startsWith("PRODUCT SOURCES:\n<source name=\"deck p.1\">\nWe read claim forms in Vietnamese.");
		assertThat(message).doesNotContain("USE CASE", "Claims triage");
		assertThat(message).endsWith("as instructed.");
	}

}
