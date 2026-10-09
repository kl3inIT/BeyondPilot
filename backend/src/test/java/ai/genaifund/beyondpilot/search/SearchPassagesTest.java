package ai.genaifund.beyondpilot.search;

import static ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.SOLUTION;
import static ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.CUSTOMER_CASE;
import static ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.DECK;
import static ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.READ_AS_TEXT;
import static ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.UNREAD;
import static ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.WEBSITE;
import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestPdf;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.ai.AiProviderChange;
import ai.genaifund.beyondpilot.ai.AiProviders;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.search.dto.SearchRequest;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Document;
import ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchPassageRepository.Passage;
import ai.genaifund.beyondpilot.solution.CustomerCase;
import ai.genaifund.beyondpilot.solution.SolutionDeck;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * The passages of a solution's deck, website and customer cases against PostgreSQL with pgvector: kept a source at a
 * time, embedded by the job that embeds the index, and out of the public search's sight. The model is the stand-in of
 * {@link SearchMeaningTest}.
 */
@SpringBootTest
@Import({ TestcontainersConfiguration.class, SearchMeaningTest.Model.class })
class SearchPassagesTest {

	private static final String MODEL = "text-embedding-3-large";

	/** A key made for this run, so that no key is written in the repository. */
	@DynamicPropertySource
	static void encryptionKey(DynamicPropertyRegistry registry) {
		byte[] key = new byte[32];
		new SecureRandom().nextBytes(key);
		registry.add("beyondpilot.ai.encryption-key", () -> Base64.getEncoder().encodeToString(key));
	}

	@Autowired
	private SearchPassageRepository passages;

	@Autowired
	private SearchDocumentRepository index;

	@Autowired
	private SearchEmbeddings embeddings;

	@Autowired
	private SearchService search;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private AiProviders providers;

	@Autowired
	private EmbeddingClients clients;

	@Autowired
	private SolutionPassages solutionPassages;

	@Autowired
	private SolutionEvidence evidence;

	/** Nothing indexed, and OpenAI's large model set the way an operator sets it, with semantic search on. */
	@BeforeEach
	void emptyIndex() {
		jdbc.sql("delete from search_passage").update();
		jdbc.sql("delete from search_document").update();
		jdbc.sql("update search_settings set provider_id = null, model = null, semantic_enabled = true").update();
		jdbc.sql("delete from ai_provider").update();
		UUID provider = providers
			.connect(new Operator(UUID.randomUUID(), "Test", "test@search.test"), AiProviders.EMBEDDING,
					new AiProviderChange("openai", "openai", "OpenAI", "https://api.openai.com/v1", true,
							AiProviderChange.Key.REPLACE, "sk-test", 0))
			.id();
		jdbc.sql("update search_settings set provider_id = ?, model = ?, model_since = now()")
			.param(provider)
			.param(MODEL)
			.update();
		clients.reload();
		embeddings.forget();
	}

	@Test
	void theJobEmbedsEveryPassageThatHasTextUnderWhatItIsOf() {
		UUID solution = UUID.randomUUID();
		passages.replace(solution, DECK, "file-1",
				List.of(new Passage(DECK, 1, 0, null, "Hotline Assist, deck page 1", "Answers inbound customer calls.",
						READ_AS_TEXT),
						// A page that is only a picture: nothing to embed until something reads it.
						new Passage(DECK, 2, 0, null, "Hotline Assist, deck page 2", "", UNREAD)));
		passages.replace(solution, WEBSITE, "load",
				List.of(new Passage(WEBSITE, 1, 0, "https://hotline.test/", "Hotline Assist, hotline.test",
						"Demand forecasting for retail stores.", READ_AS_TEXT)));

		embeddings.embedPending();

		assertThat(passages.pendingEmbeddings(MODEL, 10)).isEmpty();
		assertThat(jdbc.sql("select count(*) from search_passage where embedding is not null and embedding_model = ?")
			.param(MODEL)
			.query(Long.class)
			.single()).isEqualTo(2);
		// Another model's vectors are never compared with this one's, so every passage with text waits for it.
		assertThat(passages.pendingEmbeddings("another-model", 10)).hasSize(2);
		assertThat(passages.of(solution)).extracting(Passage::heading)
			.containsExactly("Hotline Assist, deck page 1", "Hotline Assist, deck page 2",
					"Hotline Assist, hotline.test");
	}

	@Test
	void aSourceIsReplacedAsAWholeAndTheOtherSourcesStay() {
		UUID solution = UUID.randomUUID();
		passages.replace(solution, DECK, "file-1",
				List.of(new Passage(DECK, 1, 0, null, "Hotline Assist, deck page 1", "The first deck.", READ_AS_TEXT),
						new Passage(DECK, 2, 0, null, "Hotline Assist, deck page 2", "Its second page.", READ_AS_TEXT)));
		passages.replace(solution, WEBSITE, "load", List.of(new Passage(WEBSITE, 1, 0, "https://hotline.test/",
				"Hotline Assist, hotline.test", "The website.", READ_AS_TEXT)));

		passages.replace(solution, DECK, "file-2",
				List.of(new Passage(DECK, 1, 0, null, "Hotline Assist, deck page 1", "The new deck.", READ_AS_TEXT)));

		assertThat(passages.origin(solution, DECK)).contains("file-2");
		assertThat(passages.of(solution)).extracting(Passage::text).containsExactly("The new deck.", "The website.");

		passages.removeOf(solution);
		assertThat(passages.of(solution)).isEmpty();
		assertThat(passages.origin(solution, DECK)).isEmpty();
	}

	@Test
	void aPassageTheProviderRefusesIsHeldBackAloneAndTheOthersAreEmbedded() {
		UUID solution = UUID.randomUUID();
		passages.replace(solution, DECK, "file-1",
				List.of(new Passage(DECK, 1, 0, null, "Hotline Assist, deck page 1", "Answers customer calls.",
						READ_AS_TEXT),
						new Passage(DECK, 2, 0, null, "Hotline Assist, deck page 2", "A page it refuses !!",
								READ_AS_TEXT)));

		embeddings.embedPending();

		assertThat(jdbc.sql("select page, embedding is not null, embedding_attempts from search_passage order by page")
			.query((row, number) -> row.getInt(1) + " " + row.getBoolean(2) + " " + row.getInt(3))
			.list()).containsExactly("1 true 0", "2 false 1");
		// Held back, so the next run does not send it again at once.
		assertThat(passages.pendingEmbeddings(MODEL, 10)).isEmpty();
	}

	@Test
	void aDecksPagesBecomePassagesAndAPageWithoutTextWaitsUnread() {
		UUID solution = UUID.randomUUID();
		UUID file = UUID.randomUUID();
		byte[] pdf = TestPdf.of("Answers inbound customer calls in Vietnamese.", "",
				"Demand forecasting for retail stores.");

		solutionPassages.deck(solution, "Hotline Assist",
				new SolutionDeck(file, "deck.pdf", () -> new ByteArrayInputStream(pdf)));

		assertThat(passages.origins(DECK)).containsEntry(solution, file.toString());
		assertThat(passages.of(solution)).extracting(Passage::heading, Passage::text, Passage::reading)
			.containsExactly(
					org.assertj.core.groups.Tuple.tuple("Hotline Assist, deck page 1",
							"Answers inbound customer calls in Vietnamese.", READ_AS_TEXT),
					org.assertj.core.groups.Tuple.tuple("Hotline Assist, deck page 2", "", UNREAD),
					org.assertj.core.groups.Tuple.tuple("Hotline Assist, deck page 3",
							"Demand forecasting for retail stores.", READ_AS_TEXT));
	}

	@Test
	void aDeckThatCannotBeReadLeavesOneUnreadPageAndIsNotTriedAgain() {
		UUID solution = UUID.randomUUID();
		UUID file = UUID.randomUUID();

		solutionPassages.deck(solution, "Hotline Assist",
				new SolutionDeck(file, "deck.pdf", () -> new ByteArrayInputStream("not a PDF".getBytes())));

		assertThat(passages.of(solution)).extracting(Passage::reading).containsExactly(UNREAD);
		// The job compares this with the solution's deck file: the same file is not read again.
		assertThat(passages.origins(DECK)).containsEntry(solution, file.toString());
	}

	@Test
	void whatAModelReadsOnAnUnreadPageIsKeptAndThePageIsNotAskedForAgain() {
		UUID solution = UUID.randomUUID();
		passages.replace(solution, DECK, "file-1",
				List.of(new Passage(DECK, 1, 0, null, "Hotline Assist, deck page 1", "", UNREAD),
						new Passage(DECK, 2, 0, null, "Hotline Assist, deck page 2", "", UNREAD),
						new Passage(DECK, 3, 0, null, "Hotline Assist, deck page 3", "Has text.", READ_AS_TEXT)));
		assertThat(passages.unreadDeck()).hasValueSatisfying(unread -> {
			assertThat(unread.solutionId()).isEqualTo(solution);
			assertThat(unread.origin()).isEqualTo("file-1");
			assertThat(unread.pages()).containsExactly(1, 2);
		});

		passages.saveReading(solution, 1, "Answers customer calls.");
		// The model looked at page 2 and found no text.
		passages.saveReading(solution, 2, "");

		assertThat(passages.unreadDeck()).isEmpty();
		assertThat(passages.of(solution)).extracting(Passage::text, Passage::reading)
			.containsExactly(org.assertj.core.groups.Tuple.tuple("Answers customer calls.", "model"),
					org.assertj.core.groups.Tuple.tuple("", "model"),
					org.assertj.core.groups.Tuple.tuple("Has text.", READ_AS_TEXT));
		// Only the page that now has text waits for a vector, beside the one that always had.
		assertThat(passages.pendingEmbeddings(MODEL, 10)).hasSize(2);
	}

	@Test
	void customerCasesArePassagesAndTheSameCasesKeepTheirVectors() {
		UUID solution = UUID.randomUUID();
		List<CustomerCase> cases = List.of(new CustomerCase(UUID.randomUUID(), "Viet Bank", "Call centre",
				"Long waits on the hotline.", "Answers inbound customer calls.", null));

		solutionPassages.cases(solution, "Hotline Assist", cases);
		embeddings.embedPending();
		solutionPassages.cases(solution, "Hotline Assist", cases);

		assertThat(passages.of(solution)).extracting(Passage::source, Passage::heading)
			.containsExactly(org.assertj.core.groups.Tuple.tuple(CUSTOMER_CASE, "Hotline Assist, customer case 1"));
		assertThat(passages.of(solution).getFirst().text()).contains("Customer: Viet Bank", "Delivered: Answers")
			.doesNotContain("Result:");
		assertThat(passages.pendingEmbeddings(MODEL, 10)).as("written once, so still embedded").isEmpty();

		solutionPassages.cases(solution, "Hotline Assist", List.of());
		assertThat(passages.of(solution)).isEmpty();
	}

	@Test
	void thePublicSearchNeverFindsASolutionByWhatOnlyItsPassagesSay() {
		UUID solution = UUID.randomUUID();
		index.save(new Document(SOLUTION, solution, "hotline-assist", "Hotline Assist", "Nhanh", "Answers calls.", "",
				"Hotline Assist\nAnswers calls.", Map.of(), true, null, null));
		passages.replace(solution, DECK, "file-1", List.of(new Passage(DECK, 1, 0, null, "Hotline Assist, deck page 1",
				"Underwriting for insurance carriers.", READ_AS_TEXT)));
		embeddings.embedPending();

		assertThat(search.search(new SearchRequest("insurance", SOLUTION, 1)).items()).isEmpty();
		assertThat(search.search(new SearchRequest("bảo hiểm", SOLUTION, 1)).items()).isEmpty();
	}

	@Test
	void matchingFindsASolutionByItsProfileOrByWhatItsPassagesSayListedOrNot() {
		UUID byProfile = UUID.randomUUID();
		UUID byDeck = UUID.randomUUID();
		UUID unrelated = UUID.randomUUID();
		UUID gone = UUID.randomUUID();
		index.save(new Document(SOLUTION, byProfile, "claims-desk", "Claims Desk", "Nhanh",
				"Underwriting for insurance carriers.", "", "Claims Desk\nUnderwriting for insurance carriers.", Map.of(),
				true, null, null));
		// Its owners keep it out of the directory, and only its deck says what it does.
		index.save(new Document(SOLUTION, byDeck, "hotline-assist", "Hotline Assist", "Nhanh", "Answers calls.", "",
				"Hotline Assist\nAnswers calls.", Map.of(), false, null, null));
		index.save(new Document(SOLUTION, unrelated, "shelf-planner", "Shelf Planner", "Nhanh",
				"Demand forecasting for retail stores.", "", "Shelf Planner\nDemand forecasting for retail stores.",
				Map.of(), true, null, null));
		passages.replace(byDeck, DECK, "file-1", List.of(new Passage(DECK, 1, 0, null, "Hotline Assist, deck page 1",
				"An underwriting assistant for insurance carriers.", READ_AS_TEXT)));
		// Text that was loaded stays when its solution leaves the index; it is never a candidate.
		passages.replace(gone, WEBSITE, "load", List.of(new Passage(WEBSITE, 1, 0, "https://gone.test/",
				"Gone, gone.test", "Insurance underwriting.", READ_AS_TEXT)));
		embeddings.embedPending();

		List<UUID> found = evidence.solutionsFor(List.of("Supports the underwriting of insurance policies"), 10);

		assertThat(found).doesNotContain(gone);
		assertThat(found.subList(0, 2)).containsExactlyInAnyOrder(byProfile, byDeck);
		assertThat(evidence.solutionsFor(List.of("Supports the underwriting of insurance policies"), 1)).hasSize(1);
		// A query of words every text holds asks nothing.
		assertThat(evidence.solutionsFor(List.of("the of and"), 10)).isEmpty();
		assertThat(SolutionEvidence.terms("Answers the customer's calls in real-time"))
			.isEqualTo("answers | customer | calls | real | time");
		assertThat(evidence.passagesOf(byDeck)).extracting(SolutionEvidence.Passage::source,
				SolutionEvidence.Passage::page, SolutionEvidence.Passage::text, SolutionEvidence.Passage::byModel)
			.containsExactly(org.assertj.core.groups.Tuple.tuple(DECK, 1,
					"An underwriting assistant for insurance carriers.", false));
	}

}
