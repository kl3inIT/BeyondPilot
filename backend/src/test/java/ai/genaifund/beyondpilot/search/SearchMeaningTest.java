package ai.genaifund.beyondpilot.search;

import static ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.SOLUTION;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.IntStream;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.search.dto.SearchItem;
import ai.genaifund.beyondpilot.search.dto.SearchRequest;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Document;
import com.openai.core.http.Headers;
import com.openai.errors.BadRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.embedding.Embedding;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.annotation.DirtiesContext;

/**
 * Search by meaning against PostgreSQL with pgvector. The model is a stand-in whose vectors are exact: each text points
 * along the topics its words name, so which item a query finds is known in advance, the way persistent-agent-runtime
 * tests its hybrid ranking with basis vectors.
 */
@SpringBootTest
@Import({ TestcontainersConfiguration.class, SearchMeaningTest.Model.class })
class SearchMeaningTest {

	@Autowired
	private SearchDocumentRepository index;

	@Autowired
	private SearchEmbeddings embeddings;

	@Autowired
	private SearchService search;

	@Autowired
	private Topics model;

	@Autowired
	private JdbcClient jdbc;

	@BeforeEach
	void emptyIndex() {
		jdbc.sql("delete from search_document").update();
		model.failing.set(false);
	}

	@Test
	void aQueryFindsWhatItMeansWithoutSharingAWord() {
		save("Hotline Assist", "Answers inbound customer calls and hands the rest to an agent.");
		save("ShopSense", "Demand forecasting for retail stores.");
		embeddings.embedPending();

		assertThat(titles("chăm sóc khách hàng")).containsExactly("Hotline Assist");
		assertThat(titles("dự báo bán lẻ")).containsExactly("ShopSense");
		// Nothing near enough in meaning, and no word in common: no result.
		assertThat(titles("công thức nấu phở")).isEmpty();
	}

	@Test
	void anItemIsEmbeddedAgainOnlyWhenItsTextOrTheModelChanges() {
		UUID id = save("Hotline Assist", "Answers inbound customer calls.");
		embeddings.embedPending();
		assertThat(index.pendingEmbeddings("text-embedding-3-large", 10)).isEmpty();
		// Another model's vectors are never compared with this one's, so all wait for it.
		assertThat(index.pendingEmbeddings("another-model", 10)).hasSize(1);

		index.save(document(id, "Hotline Assist", "Answers inbound customer calls."));
		assertThat(index.pendingEmbeddings("text-embedding-3-large", 10)).isEmpty();

		index.save(document(id, "Hotline Assist", "Answers inbound customer calls in Vietnamese."));
		assertThat(index.pendingEmbeddings("text-embedding-3-large", 10)).hasSize(1);
	}

	@Test
	// The provider stays paused after this test; the next test starts with a new one.
	@DirtiesContext(methodMode = DirtiesContext.MethodMode.AFTER_METHOD)
	void whenTheProviderFailsSearchGoesByWordsAndNoItemIsChargedForIt() {
		save("Hotline Assist", "Answers inbound customer calls.");
		save("ShopSense", "Demand forecasting for retail stores.");
		model.failing.set(true);

		embeddings.embedPending();
		assertThat(jdbc.sql("select max(embedding_attempts) from search_document").query(Integer.class).single())
			.as("an outage holds back no item").isZero();

		assertThat(titles("customer calls")).containsExactly("Hotline Assist");
		assertThat(titles("chăm sóc khách hàng")).isEmpty();
	}

	@Test
	void aQueryTheProviderRefusesFailsAloneAndPausesNothing() {
		save("Hotline Assist", "Answers inbound customer calls.");
		embeddings.embedPending();

		// The words still find it.
		assertThat(titles("customer calls !!")).containsExactly("Hotline Assist");
		// The refused query paused nothing: the next one is still searched by meaning.
		assertThat(titles("chăm sóc khách hàng")).containsExactly("Hotline Assist");
	}

	private List<String> titles(String query) {
		return search.search(new SearchRequest(query, SOLUTION, 1)).items().stream().map(SearchItem::title).toList();
	}

	private UUID save(String title, String summary) {
		UUID id = UUID.randomUUID();
		index.save(document(id, title, summary));
		return id;
	}

	private static Document document(UUID id, String title, String summary) {
		return new Document(SOLUTION, id, "slug-" + id, title, "Nhanh", summary, "", title + "\n" + summary, Map.of(),
				true, null, null);
	}

	/** A model whose vectors are the topics a text names: customer service, retail, insurance, or none of them. */
	static class Topics implements EmbeddingModel {

		private static final Map<String, Integer> WORDS = Map.ofEntries(Map.entry("customer", 0), Map.entry("calls", 0),
				Map.entry("khách", 0), Map.entry("hàng", 0), Map.entry("chăm", 0), Map.entry("sóc", 0),
				Map.entry("retail", 1), Map.entry("stores", 1), Map.entry("forecasting", 1), Map.entry("bán", 1),
				Map.entry("lẻ", 1), Map.entry("dự", 1), Map.entry("báo", 1), Map.entry("insurance", 2),
				Map.entry("bảo", 2), Map.entry("hiểm", 2));

		final AtomicBoolean failing = new AtomicBoolean();

		@Override
		public EmbeddingResponse call(EmbeddingRequest request) {
			if (failing.get()) {
				throw new IllegalStateException("The provider is down");
			}
			List<String> texts = request.getInstructions();
			if (texts.stream().anyMatch(text -> text.contains("!!"))) {
				throw BadRequestException.builder().headers(Headers.builder().build()).build();
			}
			return new EmbeddingResponse(
					IntStream.range(0, texts.size())
						.mapToObj(i -> new Embedding(vector(texts.get(i)), i))
						.toList());
		}

		@Override
		public float[] embed(org.springframework.ai.document.Document document) {
			return vector(document.getText() == null ? "" : document.getText());
		}

		@Override
		public int dimensions() {
			return 1536;
		}

		private static float[] vector(String text) {
			float[] vector = new float[1536];
			for (String word : text.toLowerCase(Locale.ROOT).split("[^\\p{L}]+")) {
				Integer topic = WORDS.get(word);
				if (topic != null) {
					vector[topic] += 1;
				}
			}
			// A text that names no topic points along a direction of its own.
			vector[1535] += 0.5f;
			double norm = 0;
			for (float value : vector) {
				norm += value * value;
			}
			for (int i = 0; i < vector.length; i++) {
				vector[i] /= (float) Math.sqrt(norm);
			}
			return vector;
		}

	}

	@TestConfiguration(proxyBeanMethods = false)
	static class Model {

		@Bean
		Topics topics() {
			return new Topics();
		}

	}

}
