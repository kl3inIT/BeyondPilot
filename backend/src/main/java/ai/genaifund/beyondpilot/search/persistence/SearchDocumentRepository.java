package ai.genaifund.beyondpilot.search.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
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

	public static final String USE_CASE = "use_case";

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
			by_meaning as (
			    select kind, item_id, row_number() over (order by distance, item_id) as position
			    from (select d.kind, d.item_id, d.embedding <=> cast(:vector as vector) as distance
			          from search_document d
			          where cast(:vector as vector) is not null and d.embedding is not null
			            and d.embedding_model = :model and (d.listed or not :listedOnly)
			          order by d.embedding <=> cast(:vector as vector)
			          limit :pool) nearest
			    where distance <= :maxDistance
			),
			matched as (
			    select ranked.kind, ranked.item_id, sum(1.0 / (:fusionK + ranked.position)) as score
			    from (select * from by_text union all select * from by_title union all select * from by_meaning) ranked
			    join search_document d on d.kind = ranked.kind and d.item_id = ranked.item_id
			    -- A use case stops taking proposals at its close date and leaves the results then, not at the repair.
			    where d.kind <> 'use_case' or d.facets ->> 'closesAt' is null
			       or cast(d.facets ->> 'closesAt' as timestamptz) > now()
			    group by ranked.kind, ranked.item_id
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

	/**
	 * One result, in the order of the ranking.
	 * @param snippet the summary, or a person's headline, with each word the query matched between {@link #MARK_START}
	 * and {@link #MARK_END}
	 */
	public record Hit(String kind, UUID itemId, String slug, String title, @Nullable String subtitle, String summary,
			String snippet, Map<String, Object> facets, @Nullable LocalDate startsOn, @Nullable LocalDate endsOn) {
	}

	/**
	 * The query's embedding, which adds the items nearest in meaning to those its words match.
	 * @param model the model that made the vector; only vectors of the same model are compared
	 * @param minSimilarity the least cosine similarity an item needs to count as a match
	 * @param pool how many of the nearest the branch takes before ranking
	 */
	public record Meaning(String model, float[] vector, double minSimilarity, int pool) {
	}

	/** An item whose vector is missing, stale or of another model. */
	public record Pending(String kind, UUID itemId, String card, String contentHash) {
	}

	/** Opens a matched word in a snippet; a control character no text a person writes carries. */
	public static final char MARK_START = '';

	/** Closes a matched word in a snippet. */
	public static final char MARK_END = '';

	/**
	 * The columns of a result, and the snippet: {@code ts_headline} marks the matched words in the unaccented text, so
	 * "doi moi" marks "Đổi mới", and {@link #snippet} carries the marks over to the text as written.
	 */
	private static final String RESULT = """
			select d.kind, d.item_id, d.slug, d.title, d.subtitle, d.summary, d.facets, d.starts_on, d.ends_on,
			       case when d.kind = 'talent' then coalesce(d.subtitle, d.summary) else d.summary end as source,
			       ts_headline('simple',
			           search_unaccent(case when d.kind = 'talent' then coalesce(d.subtitle, d.summary) else d.summary end),
			           input.query, :headline) as marked
			""";

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
				    ends_on = excluded.ends_on, indexed_at = now(), embedding_attempts = 0,
				    embedding_next_attempt_at = null, embedding_error = null
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
	 * The items to embed with this model, the longest waiting first: those without a vector, with a vector of an older
	 * text or of another model, whose next attempt is due.
	 */
	public List<Pending> pendingEmbeddings(String model, int limit) {
		return jdbc.sql("""
				select kind, item_id, card, content_hash from search_document
				where (embedded_hash is distinct from content_hash or embedding_model is distinct from :model)
				  and (embedding_next_attempt_at is null or embedding_next_attempt_at <= now())
				order by indexed_at, kind, item_id
				limit :limit
				""")
			.param("model", model)
			.param("limit", limit)
			.query((row, number) -> new Pending(row.getString("kind"), row.getObject("item_id", UUID.class),
					row.getString("card"), row.getString("content_hash")))
			.list();
	}

	/**
	 * Keeps the vector of the item's text. A text that changed while it was being embedded keeps waiting for its own.
	 * @return whether the vector was kept
	 */
	public boolean saveEmbedding(Pending item, String model, float[] embedding) {
		return jdbc.sql("""
				update search_document
				set embedding = cast(:embedding as vector), embedding_model = :model, embedded_hash = content_hash,
				    embedding_attempts = 0, embedding_next_attempt_at = null, embedding_error = null
				where kind = :kind and item_id = :itemId and content_hash = :hash
				""")
			.param("embedding", vector(embedding))
			.param("model", model)
			.param("kind", item.kind())
			.param("itemId", item.itemId())
			.param("hash", item.contentHash())
			.update() == 1;
	}

	/**
	 * Holds back an item the provider refused on its own, a little longer each time it is refused.
	 * @param error the kind of failure, never the provider's message
	 * @return how many times it has been refused
	 */
	public int deferEmbedding(Pending item, String error) {
		return jdbc.sql("""
				update search_document
				set embedding_attempts = embedding_attempts + 1, embedding_error = :error,
				    embedding_next_attempt_at = now() + least(interval '6 hours',
				        interval '1 minute' * power(4, embedding_attempts))
				where kind = :kind and item_id = :itemId
				returning embedding_attempts
				""")
			.param("error", error)
			.param("kind", item.kind())
			.param("itemId", item.itemId())
			.query(Integer.class)
			.optional()
			.orElse(0);
	}

	/**
	 * What one kind holds: everything in the index, what visitors may find, what is embedded with the model, what waits
	 * for it, and what the provider refused and is held back.
	 */
	public record KindStatus(String kind, long total, long listed, long embedded, long waiting, long heldBack) {
	}

	/** An item the provider refused, with the kind of failure and when it is tried again. */
	public record HeldBack(String kind, UUID itemId, String title, String error, int attempts,
			@Nullable Instant nextAttemptAt) {
	}

	/**
	 * The state of each kind against the model search embeds with.
	 * @param model the model in use, or null when none is: then nothing counts as embedded
	 */
	public List<KindStatus> status(@Nullable String model) {
		return jdbc.sql("""
				select kind, total, listed, embedded, held_back, total - embedded - held_back as waiting
				from (
				    select kind, count(*) as total, count(*) filter (where listed) as listed,
				           count(*) filter (where embedding_model = :model and embedded_hash = content_hash) as embedded,
				           count(*) filter (where embedding_error is not null and (embedding_model is distinct from :model
				                            or embedded_hash is distinct from content_hash)) as held_back
				    from search_document
				    group by kind
				) counted
				""")
			.param("model", model, Types.VARCHAR)
			.query((row, number) -> new KindStatus(row.getString("kind"), row.getLong("total"), row.getLong("listed"),
					row.getLong("embedded"), row.getLong("waiting"), row.getLong("held_back")))
			.list();
	}

	/** The items held back, the soonest to be tried again first. */
	public List<HeldBack> heldBack(int limit) {
		return jdbc.sql("""
				select kind, item_id, title, embedding_error, embedding_attempts, embedding_next_attempt_at
				from search_document
				where embedding_error is not null
				order by embedding_next_attempt_at nulls first, title
				limit :limit
				""")
			.param("limit", limit)
			.query((row, number) -> new HeldBack(row.getString("kind"), row.getObject("item_id", UUID.class),
					row.getString("title"), row.getString("embedding_error"), row.getInt("embedding_attempts"),
					instant(row.getTimestamp("embedding_next_attempt_at"))))
			.list();
	}

	/**
	 * Lets the next run try held-back items at once: one, or all when no item is named.
	 * @return how many were let go
	 */
	public int retryEmbeddings(@Nullable String kind, @Nullable UUID itemId) {
		return jdbc.sql("""
				update search_document
				set embedding_attempts = 0, embedding_next_attempt_at = null, embedding_error = null
				where embedding_error is not null
				  and (cast(:itemId as uuid) is null or (kind = :kind and item_id = cast(:itemId as uuid)))
				""")
			.param("kind", kind, Types.VARCHAR)
			.param("itemId", itemId == null ? null : itemId.toString(), Types.VARCHAR)
			.update();
	}

	private static @Nullable Instant instant(java.sql.@Nullable Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant();
	}

	/** pgvector's text form of a vector: "[0.1,0.2]". */
	static String vector(float[] values) {
		StringBuilder text = new StringBuilder(values.length * 12).append('[');
		for (int i = 0; i < values.length; i++) {
			if (i > 0) {
				text.append(',');
			}
			text.append(values[i]);
		}
		return text.append(']').toString();
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
	public Map<String, Long> counts(String query, @Nullable Meaning meaning, boolean listedOnly) {
		Map<String, Long> counts = new LinkedHashMap<>();
		matching(MATCHES.formatted(terms(query)) + "select kind, count(*) as total from matched group by kind", query,
				meaning, listedOnly)
			.query((row, number) -> Map.entry(row.getString("kind"), row.getLong("total")))
			.list()
			.forEach(entry -> counts.put(entry.getKey(), entry.getValue()));
		return counts;
	}

	/**
	 * One page of the items matching the query, best first.
	 * @param kind the kind to keep, or null for every kind
	 */
	public List<Hit> page(String query, @Nullable Meaning meaning, @Nullable String kind, boolean listedOnly, int limit,
			int offset) {
		String sql = MATCHES.formatted(terms(query)) + RESULT + """
				from matched m join search_document d on d.kind = m.kind and d.item_id = m.item_id cross join input
				where cast(:kind as text) is null or d.kind = :kind
				order by m.score desc, d.title, d.item_id
				limit :limit offset :offset
				""";
		return matching(sql, query, meaning, listedOnly).param("kind", kind, Types.VARCHAR)
			.param("limit", limit)
			.param("offset", offset)
			.query((row, number) -> hit(row))
			.list();
	}

	/**
	 * The best items of each kind, at most {@code perKind} of each: the kinds in the order of their best item, each
	 * kind's items best first.
	 */
	public List<Hit> bestOfEachKind(String query, @Nullable Meaning meaning, boolean listedOnly, int perKind) {
		String sql = MATCHES.formatted(terms(query)) + RESULT + """
				from (select kind, item_id, score,
				             row_number() over (partition by kind order by score desc, item_id) as place,
				             max(score) over (partition by kind) as kind_best
				      from matched) m
				join search_document d on d.kind = m.kind and d.item_id = m.item_id cross join input
				where m.place <= :perKind
				order by m.kind_best desc, m.kind, m.score desc, d.title, d.item_id
				""";
		return matching(sql, query, meaning, listedOnly).param("perKind", perKind)
			.query((row, number) -> hit(row))
			.list();
	}

	private Hit hit(ResultSet row) throws SQLException {
		String source = row.getString("source");
		return new Hit(row.getString("kind"), row.getObject("item_id", UUID.class), row.getString("slug"),
				row.getString("title"), row.getString("subtitle"), row.getString("summary"),
				snippet(source == null ? "" : source, row.getString("marked")), facets(row.getString("facets")),
				row.getObject("starts_on", LocalDate.class), row.getObject("ends_on", LocalDate.class));
	}

	/**
	 * The text as written with the marks {@code ts_headline} set in its unaccented form. Unaccenting keeps one letter
	 * for one letter in Vietnamese, so a mark falls at the same place in both; a text where it does not, such as one
	 * with a ligature, comes back unmarked rather than marked in the wrong place.
	 */
	static String snippet(String source, @Nullable String marked) {
		if (marked == null) {
			return source;
		}
		StringBuilder out = new StringBuilder(source.length() + 8);
		int at = 0;
		for (int i = 0; i < marked.length(); i++) {
			char c = marked.charAt(i);
			if (c == MARK_START || c == MARK_END) {
				out.append(c);
			}
			else if (at < source.length()) {
				out.append(source.charAt(at++));
			}
			else {
				return source;
			}
		}
		return at == source.length() ? out.toString() : source;
	}

	private JdbcClient.StatementSpec matching(String sql, String query, @Nullable Meaning meaning, boolean listedOnly) {
		JdbcClient.StatementSpec statement = jdbc.sql(sql)
			.param("text", query)
			.param("vector", meaning == null ? null : vector(meaning.vector()), Types.VARCHAR)
			.param("model", meaning == null ? "" : meaning.model())
			.param("pool", meaning == null ? 0 : meaning.pool())
			.param("maxDistance", meaning == null ? 0.0 : 1.0 - meaning.minSimilarity())
			.param("listedOnly", listedOnly)
			.param("similarity", TITLE_SIMILARITY)
			.param("headline", "StartSel=\"" + MARK_START + "\", StopSel=\"" + MARK_END + "\", HighlightAll=true")
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
