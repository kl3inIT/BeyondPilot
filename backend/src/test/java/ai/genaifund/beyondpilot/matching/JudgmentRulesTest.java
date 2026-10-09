package ai.genaifund.beyondpilot.matching;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.matching.Judgment.Finding;
import ai.genaifund.beyondpilot.matching.Judgment.Fit;
import ai.genaifund.beyondpilot.matching.Requirements.Extracted;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Judged;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Requirement;
import ai.genaifund.beyondpilot.search.SolutionEvidence.Passage;
import ai.genaifund.beyondpilot.solution.IndexedSolution;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What code makes of a model's answers, without a model: a quote is looked for in the sources, a finding whose quote
 * is not there is lowered, and the group follows GenAI Fund's rule.
 */
class JudgmentRulesTest {

	private static final List<Requirement> REQUIREMENTS = List.of(
			new Requirement(1, MatchingRepository.CAPABILITY, MatchingRepository.REQUIRED, "Answers customer calls.",
					"answer inbound calls"),
			new Requirement(2, MatchingRepository.CAPABILITY, MatchingRepository.REQUIRED, "Summarises each call.",
					"a summary of every call"),
			new Requirement(3, MatchingRepository.CAPABILITY, MatchingRepository.OPTIONAL, "Detects the caller's mood.",
					"how the caller feels"),
			new Requirement(4, MatchingRepository.CONSTRAINT, MatchingRepository.REQUIRED, "Runs on premises.",
					"must run in our data centre"));

	private static final Sources SOURCES = Sources.of(solution(),
			List.of(new Passage("customer_case", 1, 0, null, "Customer: Lotus Bank\nDelivered: a voice agent for the hotline.",
					false),
					new Passage("deck", 3, 0, null, "Hotline Assist answers every inbound customer call in Vietnamese.",
							false),
					new Passage("deck", 4, 0, null, "After each call it writes a summary\nfor the agent.", true),
					new Passage("website", 1, 0, "https://hotline.test/", "Built on speech recognition.", false),
					new Passage("website", 1, 1, "https://hotline.test/", "Deployed at three banks.", false)));

	@Test
	void aQuoteIsFoundWhateverItsSpacingAndCaseAndIsTracedToAnotherSourceWhenTheModelMisnamesIt() {
		Map<String, String> texts = SOURCES.texts();

		assertThat(texts.keySet()).containsExactly("profile", "customer case 1", "deck p.3", "deck p.4", "website 1");
		assertThat(texts.get("website 1")).isEqualTo("Built on speech recognition.\nDeployed at three banks.");
		assertThat(Quotes.state("it writes a  SUMMARY for the agent", "deck p.4", texts)).isEqualTo(Quotes.EXACT);
		assertThat(Quotes.state("answers every inbound customer call", "deck p.4", texts))
			.isEqualTo(Quotes.OTHER_SOURCE);
		// Two sentences joined and trimmed by the model still stand on the words they share with the page.
		assertThat(Quotes.state("Hotline Assist answers inbound customer calls in Vietnamese language", "deck p.3", texts))
			.isEqualTo(Quotes.CLOSE);
		assertThat(Quotes.state("It predicts churn with a neural network", "deck p.3", texts))
			.isEqualTo(Quotes.NOT_FOUND);
		assertThat(Quotes.state("  ", "deck p.3", texts)).isEqualTo(Quotes.NONE);
		assertThat(SOURCES.unread()).isEmpty();
	}

	@Test
	void everyRequiredCapabilityMetIsDirectAndAnInventedQuoteLowersItsFinding() {
		Judgment honest = new Judgment(
				List.of(new Finding("R1", "answers every inbound customer call", "deck p.3", "met"),
						new Finding("R2", "it writes a summary for the agent", "deck p.4", "met"),
						new Finding("R3", "", "", "not_shown"), new Finding("R4", "", "", "not_shown")),
				new Fit("a voice agent for the hotline", "customer case 1", "met"), new Fit("", "", "not_shown"),
				"It answers and summarises calls.");
		Judged direct = Buckets.settle(honest, REQUIREMENTS, SOURCES, "f1");

		assertThat(direct.bucket()).isEqualTo(Buckets.DIRECT);
		assertThat(direct.requiredMet()).isEqualTo(2);
		// The constraint and the optional capability are reported and do not count.
		assertThat(direct.requiredTotal()).isEqualTo(2);
		assertThat(direct.summary()).isEqualTo("It answers and summarises calls.");

		Judgment invented = new Judgment(
				List.of(new Finding("R1", "answers every inbound customer call", "deck p.3", "met"),
						new Finding("R2", "It summarises calls with a large language model", "deck p.4", "met")),
				new Fit("a voice agent for the hotline", "customer case 1", "met"), null, null);
		Judged lowered = Buckets.settle(invented, REQUIREMENTS, SOURCES, "f2");

		// One of two required capabilities stands; the industry is shown, so the candidate is in Industry.
		assertThat(lowered.bucket()).isEqualTo(Buckets.INDUSTRY);
		assertThat(lowered.requiredMet()).isEqualTo(1);
		assertThat(statuses(lowered)).containsExactly("met", "not_shown", "not_shown", "not_shown");
		assertThat(states(lowered)).containsExactly(Quotes.EXACT, Quotes.NOT_FOUND, Quotes.NONE, Quotes.NONE);
	}

	@Test
	void theTechnologyGroupNeedsACapabilityShownOrHalfOfThemMetAndNothingShownIsNoGroup() {
		Judgment half = new Judgment(List.of(new Finding("R1", "answers every inbound customer call", "deck p.3", "met")),
				null, null, null);
		assertThat(Buckets.settle(half, REQUIREMENTS, SOURCES, "f").bucket()).isEqualTo(Buckets.TECHNOLOGY);

		Judgment technologyOnly = new Judgment(List.of(), null,
				new Fit("Built on speech recognition.", "website 1", "met"), null);
		// The technology alone, with no capability shown, is not a reason to recommend.
		assertThat(Buckets.settle(technologyOnly, REQUIREMENTS, SOURCES, "f").bucket()).isEqualTo(Buckets.NONE);

		Judgment partly = new Judgment(
				List.of(new Finding("R2", "it writes a summary for the agent", "deck p.4", "partly")), null,
				new Fit("Built on speech recognition.", "website 1", "met"), null);
		assertThat(Buckets.settle(partly, REQUIREMENTS, SOURCES, "f").bucket()).isEqualTo(Buckets.TECHNOLOGY);
	}

	@Test
	void aRequirementIsKeptOnlyWithAKnownKindAndAQuoteTheBriefHoldsCapabilitiesFirst() {
		String brief = "Problem:\nOur agents cannot answer inbound calls at night. It must run in our data centre.";
		Extracted answered = new Extracted(List.of(
				new Extracted.Item("constraint", "required", "Runs on premises.", "must run in our data centre"),
				new Extracted.Item("capability", "required", " Answers customer calls. ", "answer inbound calls at night"),
				new Extracted.Item("capability", "optional", "Speaks twelve languages.", "supports twelve languages"),
				new Extracted.Item("wish", "required", "Is cheap.", "Our agents"),
				new Extracted.Item("capability", "required", " ", "Our agents")));

		List<Requirement> kept = Requirements.checked(answered, brief);

		assertThat(kept).containsExactly(
				new Requirement(1, "capability", "required", "Answers customer calls.", "answer inbound calls at night"),
				new Requirement(2, "constraint", "required", "Runs on premises.", "must run in our data centre"));
		assertThat(kept.get(0).name()).isEqualTo("R1");
		assertThat(Requirements.checked(new Extracted(null), brief)).isEmpty();
	}

	@Test
	void aSolutionWithoutDeckOrWebsiteTextSaysWhichIsMissing() {
		Sources profileOnly = Sources.of(solution(), List.of());

		assertThat(profileOnly.texts().keySet()).containsExactly("profile");
		assertThat(profileOnly.texts().get("profile")).contains("Name: Hotline Assist", "Summary: A voice agent.");
		assertThat(profileOnly.unread()).containsExactly("deck", "website");
	}

	private static List<Object> statuses(Judged judged) {
		return findings(judged).stream().map(finding -> finding.get("status")).toList();
	}

	private static List<Object> states(Judged judged) {
		return findings(judged).stream().map(finding -> finding.get("quoteState")).toList();
	}

	@SuppressWarnings("unchecked")
	private static List<Map<String, Object>> findings(Judged judged) {
		return (List<Map<String, Object>>) judged.findings().get("requirements");
	}

	private static IndexedSolution solution() {
		return new IndexedSolution(UUID.randomUUID(), "hotline-assist", "Hotline Assist", UUID.randomUUID(), "Voice Lab",
				"voice-lab", "VN", "A voice agent.", null, null, null, null, List.of("speech recognition"),
				List.of("customer service"), List.of("banking"), "in_production", List.of("cloud"), null, 1, true);
	}

}
