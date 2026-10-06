package ai.genaifund.beyondpilot.search.persistence;

import static ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.PROGRAM;
import static ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.SOLUTION;
import static ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.TALENT;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Document;
import ai.genaifund.beyondpilot.search.persistence.SearchDocumentRepository.Hit;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * The index against PostgreSQL: what a visitor types finds the item with or without Vietnamese marks, while the last
 * word is still being typed and with a typo; titles outrank descriptions; and what only matching may use stays out of a
 * visitor's results.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class SearchDocumentRepositoryTest {

	@Autowired
	private SearchDocumentRepository index;

	@Autowired
	private JdbcClient jdbc;

	@BeforeEach
	void emptyIndex() {
		jdbc.sql("delete from search_document").update();
	}

	@Test
	void textIsFoundWithOrWithoutItsMarks() {
		save(PROGRAM, "Chương trình Đổi mới Sáng tạo", null, "Doanh nghiệp Việt Nam thử nghiệm AI", true);

		assertThat(titles("doi moi sang tao")).containsExactly("Chương trình Đổi mới Sáng tạo");
		assertThat(titles("viet nam")).containsExactly("Chương trình Đổi mới Sáng tạo");
		assertThat(titles("Đổi mới")).containsExactly("Chương trình Đổi mới Sáng tạo");
	}

	@Test
	void theLastWordIsFoundWhileItIsTyped() {
		save(SOLUTION, "AI Voice & Chat Agent", "Revve AI", "Answers calls and chats", true);

		assertThat(titles("voice ag")).containsExactly("AI Voice & Chat Agent");
		assertThat(titles("voi")).containsExactly("AI Voice & Chat Agent");
	}

	@Test
	void aTypoInATitleIsForgiven() {
		save(SOLUTION, "AI Voice & Chat Agent", "Revve AI", "Answers calls and chats", true);
		save(SOLUTION, "Claims Document Reader", "Insurtech Co", "Reads claim forms", true);

		assertThat(titles("voise agent")).containsExactly("AI Voice & Chat Agent");
		assertThat(titles("clams reader")).containsExactly("Claims Document Reader");
	}

	@Test
	void aTitleOutranksADescription() {
		save(SOLUTION, "Underwriting Copilot", "Acme", "Helps underwriters price risk with an agent", true);
		save(SOLUTION, "Agent Desk", "Beta", "A desk for customer service", true);

		assertThat(titles("agent")).containsExactly("Agent Desk", "Underwriting Copilot");
	}

	@Test
	void anUnlistedSolutionReachesMatchingButNoVisitor() {
		save(SOLUTION, "Fraud Radar", "Gamma", "Flags suspicious claims", false);

		assertThat(index.page("fraud", null, null, true, 12, 0)).isEmpty();
		assertThat(index.counts("fraud", null, true)).isEmpty();
		assertThat(index.page("fraud", null, null, false, 12, 0)).extracting(Hit::title).containsExactly("Fraud Radar");
	}

	@Test
	void countsCoverEveryKindWhateverKindIsShown() {
		save(PROGRAM, "Insurance AI Challenge", "Tasco", "A program for insurers", true);
		save(SOLUTION, "Insurance Claims Bot", "Delta", "Handles claims", true);
		save(SOLUTION, "Insurance Pricing Engine", "Epsilon", "Prices policies", true);
		save(TALENT, "Lan Nguyen", "Insurance data scientist", "Builds pricing models", true);

		assertThat(index.counts("insurance", null, true)).containsExactlyInAnyOrderEntriesOf(
				Map.of(PROGRAM, 1L, SOLUTION, 2L, TALENT, 1L));
		assertThat(index.page("insurance", null, SOLUTION, true, 12, 0)).extracting(Hit::kind)
			.containsOnly(SOLUTION)
			.hasSize(2);
		assertThat(index.page("insurance", null, null, true, 2, 2)).hasSize(2);
	}

	@Test
	void savingAgainReplacesTheRowOnlyWhenSomethingChangedAndItsHashOnlyWhenTheTextDid() {
		UUID id = save(PROGRAM, "Build Week", null, "Five days of building", true);
		String first = hash(id);
		Object indexedAt = indexedAt(id);

		index.save(document(PROGRAM, id, "Build Week", null, "Five days of building", true));
		assertThat(hash(id)).isEqualTo(first);
		// A save that changes nothing writes nothing.
		assertThat(indexedAt(id)).isEqualTo(indexedAt);

		index.save(document(PROGRAM, id, "Build Week 2026", null, "Five days of building", true));
		assertThat(hash(id)).isNotEqualTo(first);
		assertThat(titles("build week")).containsExactly("Build Week 2026");

		index.remove(PROGRAM, id);
		assertThat(titles("build week")).isEmpty();
	}

	@Test
	void textThatLooksLikeQuerySyntaxIsOnlyText() {
		save(SOLUTION, "Agent Desk", "Beta", "A desk for customer service", true);

		assertThat(titles("agent & | ! :* ( '")).containsExactly("Agent Desk");
		assertThat(titles("\"agent desk\"")).containsExactly("Agent Desk");
	}

	@Test
	void theSnippetMarksTheMatchedWordsAsTheyAreWritten() {
		save(PROGRAM, "Chương trình Đổi mới Sáng tạo", null, "Doanh nghiệp Việt Nam thử nghiệm AI", true);

		assertThat(index.page("viet nam", null, null, true, 12, 0)).extracting(Hit::snippet)
			.containsExactly("Doanh nghiệp Việt Nam thử nghiệm AI");
		// A word is marked whole, never inside another word.
		save(SOLUTION, "GenAI Desk", "Beta", "GenAI tools for AI teams", true);
		assertThat(index.page("ai teams", null, SOLUTION, true, 12, 0)).extracting(Hit::snippet)
			.containsExactly("GenAI tools for AI teams");
	}

	@Test
	void theAllTabTakesTheBestFewOfEachKindTheKindsInTheOrderOfTheirBest() {
		save(SOLUTION, "Insurance Claims Bot", "Delta", "Handles claims", true);
		save(SOLUTION, "Insurance Pricing Engine", "Epsilon", "Prices policies", true);
		save(SOLUTION, "Insurance Fraud Radar", "Gamma", "Flags claims", true);
		save(SOLUTION, "Underwriting Copilot", "Zeta", "Helps insurance underwriters", true);
		save(TALENT, "Lan Nguyen", "Data scientist", "Prices insurance risk", true);

		List<Hit> best = index.bestOfEachKind("insurance", null, true, 3);

		assertThat(best).extracting(Hit::kind).containsExactly(SOLUTION, SOLUTION, SOLUTION, TALENT);
		assertThat(best).extracting(Hit::title).doesNotContain("Underwriting Copilot");
	}

	private List<String> titles(String query) {
		return index.page(query, null, null, true, 12, 0).stream().map(Hit::title).toList();
	}

	private UUID save(String kind, String title, @Nullable String subtitle, String summary, boolean listed) {
		UUID id = UUID.randomUUID();
		index.save(document(kind, id, title, subtitle, summary, listed));
		return id;
	}

	private static Document document(String kind, UUID id, String title, @Nullable String subtitle, String summary,
			boolean listed) {
		return new Document(kind, id, "slug-" + id, title, subtitle, summary, "",
				title + "\n" + summary, Map.of("country", "VN"), listed,
				kind.equals(PROGRAM) ? LocalDate.of(2026, 11, 1) : null,
				kind.equals(PROGRAM) ? LocalDate.of(2026, 11, 30) : null);
	}

	private Object indexedAt(UUID id) {
		return jdbc.sql("select indexed_at from search_document where item_id = ?").param(id).query().singleValue();
	}

	private String hash(UUID id) {
		return jdbc.sql("select content_hash from search_document where item_id = ?")
			.param(id)
			.query(String.class)
			.single();
	}

}
