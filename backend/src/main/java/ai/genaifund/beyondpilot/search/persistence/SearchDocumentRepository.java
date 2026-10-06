package ai.genaifund.beyondpilot.search.persistence;

import java.sql.Types;
import java.time.LocalDate;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * The rows of {@code search_document} and the ranked query over them. A query is matched two ways: by full-text search
 * on the weighted, unaccented vector, with its last word also taken as the start of a word, and by the trigram
 * similarity of the query to each title, which forgives a typo. The two rankings are fused by reciprocal rank.
 */
@Repository
public class SearchDocumentRepository {

	public static final String PROGRAM = "program";

	public static final String SOLUTION = "solution";

	public static final String TALENT = "talent";

	/** Reciprocal rank fusion's constant: a result's score is the sum of 1 / (k + its position) in each ranking. */
	private static final int FUSION_K = 60;

	/** How similar a title must be to the query to count as a typo of it; pg_trgm's operators default to 0.6. */
	private static final double TITLE_SIMILARITY = 0.4;

	private static final String MATCHES = """
			with input as (
			    select %s as query, search_unaccent(:text) as text
			),
			by_text as (
			    select d.kind, d.item_id,
			           row_number() over (order by ts_rank_cd(d.search_vector, input.query) desc, d.item_id) as position
			    from search_document d cross join input
			    where d.search_vector @@ input.query and (d.listed or not :listedOnly)
			),
			by_title as (
			    select d.kind, d.item_id,
			           row_number() over (order by word_similarity(input.text, search_unaccent(d.title)) desc,
			                              d.item_id) as position
			    from search_document d cross join input
			    where word_similarity(input.text, search_unaccent(d.title)) >= :similarity
			      and (d.listed or not :listedOnly)
			),
			matched as (
			    select kind, item_id, sum(1.0 / (:fusionK + position)) as score
			    from (select * from by_text union all select * from by_title) ranked
			    group by kind, item_id
			)
			""";

	private static final String WHOLE_WORDS = "websearch_to_tsquery('simple', search_unaccent(:text))";

	/** The query as typed, or with its last word completed: "voice ag" finds "voice agent". */
	private static final String WITH_PREFIX = """
			websearch_to_tsquery('simple', search_unaccent(:text))
			    || (websearch_to_tsquery('simple', search_unaccent(:head))
			        && to_tsquery('simple', search_unaccent(:prefix) || ':*'))""";

	private final JdbcClient jdbc;

	private final JsonMapper json;

	SearchDocumentRepository(JdbcClient jdbc, JsonMapper json) {
		this.jdbc = jdbc;
		this.json = json;
	}

	/** What the index keeps of one item. */
	public record Document(String kind, UUID itemId, String slug, String title, @Nullable String subtitle,
			String summary, String keywords, String card, Map<String, Object> facets, boolean listed,
			@Nullable LocalDate startsOn, @Nullable LocalDate endsOn) {
	}

	/** One result, in the order of the ranking. */
	public record Hit(String kind, UUID itemId, String slug, String title, @Nullable String subtitle, String summary,
			Map<String, Object> facets, @Nullable LocalDate startsOn, @Nullable LocalDate endsOn) {
	}

	/**
	 * Adds the item, or replaces what the index kept of it. A row that already says the same is left alone, so its
	 * {@code indexed_at} is when its content last changed.
	 */
	public void save(Document document) {
		jdbc.sql("""
				insert into search_document (kind, item_id, slug, title, subtitle, summary, keywords, card, facets, listed,
				    starts_on, ends_on)
				values (:kind, :itemId, :slug, :title, :subtitle, :summary, :keywords, :card, cast(:facets as jsonb),
				    :listed, :startsOn, :endsOn)
				on conflict (kind, item_id) do update
				set slug = excluded.slug, title = excluded.title, subtitle = excluded.subtitle,
				    summary = excluded.summary, keywords = excluded.keywords, card = excluded.card,
				    facets = excluded.facets, listed = excluded.listed, starts_on = excluded.starts_on,
				    ends_on = excluded.ends_on, indexed_at = now()
				where (search_document.slug, search_document.title, search_document.subtitle, search_document.summary,
				       search_document.keywords, search_document.card, search_document.facets, search_document.listed,
				       search_document.starts_on, search_document.ends_on)
				      is distinct from (excluded.slug, excluded.title, excluded.subtitle, excluded.summary,
				       excluded.keywords, excluded.card, excluded.facets, excluded.listed, excluded.starts_on,
				       excluded.ends_on)
				""")
			.param("kind", document.kind())
			.param("itemId", document.itemId())
			.param("slug", document.slug())
			.param("title", document.title())
			.param("subtitle", document.subtitle(), Types.VARCHAR)
			.param("summary", document.summary())
			.param("keywords", document.keywords())
			.param("card", document.card())
			.param("facets", json.writeValueAsString(document.facets()))
			.param("listed", document.listed())
			.param("startsOn", document.startsOn(), Types.DATE)
			.param("endsOn", document.endsOn(), Types.DATE)
			.update();
	}

	/** Takes the item out of the index; nothing happens when it is not there. */
	public void remove(String kind, UUID itemId) {
		jdbc.sql("delete from search_document where kind = ? and item_id = ?").params(kind, itemId).update();
	}

	/**
	 * Takes out every item of the kind but these, which the owning module still publishes.
	 * @return how many were taken out
	 */
	public int removeAllExcept(String kind, Collection<UUID> kept) {
		if (kept.isEmpty()) {
			return jdbc.sql("delete from search_document where kind = ?").param(kind).update();
		}
		return jdbc.sql("delete from search_document where kind = :kind and item_id not in (:kept)")
			.param("kind", kind)
			.param("kept", kept)
			.update();
	}

	/**
	 * How many items of each kind match the query; a kind with none is absent.
	 * @param listedOnly whether to leave out what only matching may use, as every query serving a visitor does
	 */
	public Map<String, Long> counts(String query, boolean listedOnly) {
		Map<String, Long> counts = new LinkedHashMap<>();
		matching(MATCHES.formatted(terms(query)) + "select kind, count(*) as total from matched group by kind", query,
				listedOnly)
			.query((row, number) -> Map.entry(row.getString("kind"), row.getLong("total")))
			.list()
			.forEach(entry -> counts.put(entry.getKey(), entry.getValue()));
		return counts;
	}

	/**
	 * One page of the items matching the query, best first.
	 * @param kind the kind to keep, or null for every kind
	 */
	public List<Hit> page(String query, @Nullable String kind, boolean listedOnly, int limit, int offset) {
		String sql = MATCHES.formatted(terms(query)) + """
				select d.kind, d.item_id, d.slug, d.title, d.subtitle, d.summary, d.facets, d.starts_on, d.ends_on
				from matched m join search_document d on d.kind = m.kind and d.item_id = m.item_id
				where cast(:kind as text) is null or d.kind = :kind
				order by m.score desc, d.title, d.item_id
				limit :limit offset :offset
				""";
		return matching(sql, query, listedOnly).param("kind", kind, Types.VARCHAR)
			.param("limit", limit)
			.param("offset", offset)
			.query((row, number) -> new Hit(row.getString("kind"), row.getObject("item_id", UUID.class),
					row.getString("slug"), row.getString("title"), row.getString("subtitle"), row.getString("summary"),
					facets(row.getString("facets")), row.getObject("starts_on", LocalDate.class),
					row.getObject("ends_on", LocalDate.class)))
			.list();
	}

	private JdbcClient.StatementSpec matching(String sql, String query, boolean listedOnly) {
		JdbcClient.StatementSpec statement = jdbc.sql(sql)
			.param("text", query)
			.param("listedOnly", listedOnly)
			.param("similarity", TITLE_SIMILARITY)
			.param("fusionK", FUSION_K);
		LastWord last = LastWord.of(query);
		return last == null ? statement : statement.param("head", last.head()).param("prefix", last.prefix());
	}

	private static String terms(String query) {
		return LastWord.of(query) == null ? WHOLE_WORDS : WITH_PREFIX;
	}

	private Map<String, Object> facets(@Nullable String value) {
		return value == null ? Map.of() : json.readValue(value, new TypeReference<Map<String, Object>>() {
		});
	}

	/**
	 * The word being typed at the end of the query, and what comes before it. Only letters and digits are kept of the
	 * word, so it cannot carry the operators of {@code to_tsquery}. A query that ends in a space, a quote or a negated
	 * word has none: the person finished typing it, or asked for something exact.
	 */
	record LastWord(String head, String prefix) {

		static @Nullable LastWord of(String query) {
			if (query.isEmpty() || Character.isWhitespace(query.charAt(query.length() - 1))) {
				return null;
			}
			int start = query.length();
			while (start > 0 && !Character.isWhitespace(query.charAt(start - 1))) {
				start--;
			}
			String word = query.substring(start);
			if (word.startsWith("-") || word.contains("\"")) {
				return null;
			}
			String prefix = word.codePoints()
				.filter(Character::isLetterOrDigit)
				.collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
				.toString();
			return prefix.isEmpty() ? null : new LastWord(query.substring(0, start), prefix);
		}

	}

}
