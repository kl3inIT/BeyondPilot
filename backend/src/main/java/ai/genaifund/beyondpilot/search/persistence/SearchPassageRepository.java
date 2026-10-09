package ai.genaifund.beyondpilot.search.persistence;

import java.sql.Array;
import java.sql.Types;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * The rows of {@code search_passage}: what a solution's deck, website and customer cases say, a passage a row. The
 * passages of one source of one solution are written together and replaced together. Each waits for its vector the
 * way an item of {@code search_document} does.
 */
@Repository
public class SearchPassageRepository {

	public static final String DECK = "deck";

	public static final String WEBSITE = "website";

	public static final String CUSTOMER_CASE = "customer_case";

	/** The passage's text is the file's own, or was loaded. */
	public static final String READ_AS_TEXT = "text";

	/** A model read the passage from the picture of its page. */
	public static final String READ_BY_MODEL = "model";

	/** A page without text: it waits for a model, or none could read it. */
	public static final String UNREAD = "unread";

	/**
	 * A passage as it is kept and read.
	 * @param page the page of the deck, the place of the web page among the site's, or the place of the customer case
	 * @param part the place of the passage on its page, from 0
	 * @param locator the address of the web page; null for the other sources
	 * @param heading what the passage is of, put before its text when it is embedded
	 * @param reading {@link #READ_AS_TEXT}, {@link #READ_BY_MODEL} or {@link #UNREAD}
	 */
	public record Passage(String source, int page, int part, @Nullable String locator, String heading, String text,
			String reading) {
	}

	/** A deck with pages nothing has read, and those pages. */
	public record UnreadDeck(UUID solutionId, String origin, List<Integer> pages) {
	}

	/** A passage whose vector is missing, stale or of another model. */
	public record Pending(UUID solutionId, String source, int page, int part, String heading, String text,
			String contentHash) {
	}

	private final JdbcClient jdbc;

	SearchPassageRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * Puts these passages in the place of everything kept for one source of a solution. The caller's transaction makes
	 * it one change.
	 * @param origin what the passages were made from; see {@link #origin}
	 */
	public void replace(UUID solutionId, String source, String origin, List<Passage> passages) {
		jdbc.sql("delete from search_passage where solution_id = :solutionId and source = :source")
			.param("solutionId", solutionId)
			.param("source", source)
			.update();
		for (Passage passage : passages) {
			jdbc.sql("""
					insert into search_passage (solution_id, source, page, part, locator, heading, text, reading, origin)
					values (:solutionId, :source, :page, :part, :locator, :heading, :text, :reading, :origin)
					""")
				.param("solutionId", solutionId)
				.param("source", source)
				.param("page", passage.page())
				.param("part", passage.part())
				.param("locator", passage.locator(), Types.VARCHAR)
				.param("heading", passage.heading())
				.param("text", passage.text())
				.param("reading", passage.reading())
				.param("origin", origin)
				.update();
		}
	}

	/** What the passages kept for one source of a solution were made from; empty when none is kept. */
	public Optional<String> origin(UUID solutionId, String source) {
		return jdbc.sql("select origin from search_passage where solution_id = :solutionId and source = :source limit 1")
			.param("solutionId", solutionId)
			.param("source", source)
			.query(String.class)
			.optional();
	}

	/** What the passages of one source were made from, for every solution that has some. */
	public Map<UUID, String> origins(String source) {
		Map<UUID, String> origins = new LinkedHashMap<>();
		jdbc.sql("select distinct solution_id, origin from search_passage where source = :source")
			.param("source", source)
			.query(row -> {
				origins.put(row.getObject("solution_id", UUID.class), row.getString("origin"));
			});
		return origins;
	}

	/** Takes out the passages of one source of a solution; nothing happens when none is kept. */
	public void remove(UUID solutionId, String source) {
		jdbc.sql("delete from search_passage where solution_id = :solutionId and source = :source")
			.param("solutionId", solutionId)
			.param("source", source)
			.update();
	}

	/** The deck with the most pages nothing has read, so that a deck of pictures comes before a stray logo page. */
	public Optional<UnreadDeck> unreadDeck() {
		return jdbc.sql("""
				select solution_id, origin, array_agg(page order by page) as pages from search_passage
				where source = 'deck' and reading = 'unread'
				group by solution_id, origin
				order by count(*) desc, solution_id
				limit 1
				""").query((row, number) -> {
			Array pages = row.getArray("pages");
			return new UnreadDeck(row.getObject("solution_id", UUID.class), row.getString("origin"),
					Arrays.asList((Integer[]) pages.getArray()));
		}).optional();
	}

	/**
	 * Keeps what a model read on a page of a deck that had no text. An empty text means it looked and found none, so
	 * the page is not asked for again.
	 */
	public void saveReading(UUID solutionId, int page, String text) {
		jdbc.sql("""
				update search_passage set text = :text, reading = 'model', indexed_at = now()
				where solution_id = :solutionId and source = 'deck' and page = :page and reading = 'unread'
				""").param("text", text).param("solutionId", solutionId).param("page", page).update();
	}

	/** The passages of a solution, in the order a person would read them. */
	public List<Passage> of(UUID solutionId) {
		return jdbc.sql("""
				select source, page, part, locator, heading, text, reading from search_passage
				where solution_id = :solutionId
				order by array_position(array['customer_case', 'deck', 'website'], source), page, part
				""")
			.param("solutionId", solutionId)
			.query((row, number) -> new Passage(row.getString("source"), row.getInt("page"), row.getInt("part"),
					row.getString("locator"), row.getString("heading"), row.getString("text"),
					row.getString("reading")))
			.list();
	}

	/** Takes out everything kept for a solution; nothing happens when nothing is. */
	public void removeOf(UUID solutionId) {
		jdbc.sql("delete from search_passage where solution_id = :solutionId").param("solutionId", solutionId).update();
	}

	/**
	 * The passages to embed with this model, the longest waiting first: those with text and without a vector, with a
	 * vector of an older text or of another model, whose next attempt is due.
	 */
	public List<Pending> pendingEmbeddings(String model, int limit) {
		return jdbc.sql("""
				select solution_id, source, page, part, heading, text, content_hash from search_passage
				where text <> ''
				  and (embedded_hash is distinct from content_hash or embedding_model is distinct from :model)
				  and (embedding_next_attempt_at is null or embedding_next_attempt_at <= now())
				order by indexed_at, solution_id, source, page, part
				limit :limit
				""")
			.param("model", model)
			.param("limit", limit)
			.query((row, number) -> new Pending(row.getObject("solution_id", UUID.class), row.getString("source"),
					row.getInt("page"), row.getInt("part"), row.getString("heading"), row.getString("text"),
					row.getString("content_hash")))
			.list();
	}

	/**
	 * Keeps the vector of the passage's text. A text that changed while it was being embedded keeps waiting for its own.
	 * @return whether the vector was kept
	 */
	public boolean saveEmbedding(Pending passage, String model, float[] embedding) {
		return jdbc.sql("""
				update search_passage
				set embedding = cast(:embedding as vector), embedding_model = :model, embedded_hash = content_hash,
				    embedding_attempts = 0, embedding_next_attempt_at = null, embedding_error = null
				where solution_id = :solutionId and source = :source and page = :page and part = :part
				  and content_hash = :hash
				""")
			.param("embedding", SearchDocumentRepository.vector(embedding))
			.param("model", model)
			.param("solutionId", passage.solutionId())
			.param("source", passage.source())
			.param("page", passage.page())
			.param("part", passage.part())
			.param("hash", passage.contentHash())
			.update() == 1;
	}

	/**
	 * Holds back a passage the provider refused on its own, a little longer each time it is refused.
	 * @param error the kind of failure, never the provider's message
	 */
	public void deferEmbedding(Pending passage, String error) {
		jdbc.sql("""
				update search_passage
				set embedding_attempts = embedding_attempts + 1, embedding_error = :error,
				    embedding_next_attempt_at = now() + least(interval '6 hours',
				        interval '1 minute' * power(4, embedding_attempts))
				where solution_id = :solutionId and source = :source and page = :page and part = :part
				""")
			.param("error", error)
			.param("solutionId", passage.solutionId())
			.param("source", passage.source())
			.param("page", passage.page())
			.param("part", passage.part())
			.update();
	}

}
