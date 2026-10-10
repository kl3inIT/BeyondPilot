package ai.genaifund.beyondpilot.matching.persistence;

import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * What people said about the group the AI gave a candidate. Answers are only added: the last one a person gave about
 * a judgment is their answer. A judgment is told apart by the candidate's fingerprint and the group it was given, so
 * an answer about an earlier judgment stays as history and is not the answer about the one that replaced it.
 */
@Repository
public class MatchingFeedbackRepository {

	/** Each person's last answer about each judgment of each candidate. */
	private static final String LAST = """
			select distinct on (candidate_id, account_id, fingerprint, ai_bucket)
			       id, candidate_id, account_id, fingerprint, ai_bucket, agrees, expected_bucket, requirements, note,
			       created_at
			from matching_feedback
			order by candidate_id, account_id, fingerprint, ai_bucket, created_at desc, id
			""";

	private final JdbcClient jdbc;

	MatchingFeedbackRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * One person's answer about the judgment a candidate has now.
	 * @param expectedBucket the group they expected; null when they agree
	 * @param requirements the places of the requirements they say the AI judged wrongly
	 */
	public record Answer(UUID candidateId, UUID accountId, boolean agrees, @Nullable String expectedBucket,
			List<Integer> requirements, @Nullable String note, Instant createdAt) {
	}

	/** How many answers were given since a moment, and how many of them agreed with the AI. */
	public record Totals(long answers, long agreements) {
	}

	/**
	 * An answer that the AI's group was wrong.
	 * @param current whether it is about the judgment the candidate has now; one about an earlier judgment names
	 * requirements as they were then
	 */
	public record Disagreement(UUID id, UUID candidateId, UUID useCaseId, UUID solutionId, String aiBucket,
			String expectedBucket, List<Integer> requirements, @Nullable String note, UUID accountId, Instant createdAt,
			boolean current) {
	}

	/**
	 * Adds a person's answer about a judgment.
	 * @param fingerprint the candidate's, as it stands when the answer is given
	 * @param aiBucket the group the AI had given
	 */
	public void answer(UUID candidateId, UUID accountId, String fingerprint, String aiBucket, boolean agrees,
			@Nullable String expectedBucket, List<Integer> requirements, @Nullable String note) {
		jdbc.sql("""
				insert into matching_feedback (candidate_id, account_id, fingerprint, ai_bucket, agrees, expected_bucket,
				    requirements, note)
				values (:candidateId, :accountId, :fingerprint, :aiBucket, :agrees, :expectedBucket,
				    cast(string_to_array(:requirements, ',') as integer[]), :note)
				""")
			.param("candidateId", candidateId)
			.param("accountId", accountId)
			.param("fingerprint", fingerprint)
			.param("aiBucket", aiBucket)
			.param("agrees", agrees)
			.param("expectedBucket", expectedBucket, Types.VARCHAR)
			.param("requirements", requirements.stream().map(String::valueOf).collect(Collectors.joining(",")))
			.param("note", note, Types.VARCHAR)
			.update();
	}

	/** Everyone's answer about the judgment each candidate of a use case has now, one per person and candidate. */
	public List<Answer> current(UUID useCaseId) {
		return jdbc.sql("""
				select distinct on (f.candidate_id, f.account_id)
				       f.candidate_id, f.account_id, f.agrees, f.expected_bucket,
				       array_to_string(f.requirements, ',') as requirements, f.note, f.created_at
				from matching_feedback f
				join matching_candidate c on c.id = f.candidate_id
				where c.use_case_id = :useCaseId and f.fingerprint = c.fingerprint and f.ai_bucket = c.bucket
				order by f.candidate_id, f.account_id, f.created_at desc, f.id
				""")
			.param("useCaseId", useCaseId)
			.query((row, number) -> new Answer(row.getObject("candidate_id", UUID.class),
					row.getObject("account_id", UUID.class), row.getBoolean("agrees"), row.getString("expected_bucket"),
					places(row.getString("requirements")), row.getString("note"),
					row.getTimestamp("created_at").toInstant()))
			.list();
	}

	/** How people answered since a moment: each person's last answer about each judgment counts once. */
	public Totals totals(Instant since) {
		return jdbc
			.sql("select count(*) as answers, count(*) filter (where agrees) as agreements from (" + LAST
					+ ") f where f.created_at >= :since")
			.param("since", Timestamp.from(since))
			.query((row, number) -> new Totals(row.getLong("answers"), row.getLong("agreements")))
			.single();
	}

	/** How many answers say the AI's group was wrong, each person's last answer about each judgment counting once. */
	public long disagreementCount() {
		return jdbc.sql("select count(*) from (" + LAST + ") f where not f.agrees").query(Long.class).single();
	}

	/** One page of the answers that say the AI's group was wrong, newest first. */
	public List<Disagreement> disagreements(int limit, long offset) {
		return jdbc.sql("""
				select f.id, f.candidate_id, c.use_case_id, c.solution_id, f.ai_bucket, f.expected_bucket,
				       array_to_string(f.requirements, ',') as requirements, f.note, f.account_id, f.created_at,
				       (f.fingerprint = c.fingerprint and f.ai_bucket = c.bucket) as current
				from (""" + LAST + """
				) f
				join matching_candidate c on c.id = f.candidate_id
				where not f.agrees
				order by f.created_at desc, f.id
				limit :limit offset :offset
				""")
			.param("limit", limit)
			.param("offset", offset)
			.query((row, number) -> new Disagreement(row.getObject("id", UUID.class),
					row.getObject("candidate_id", UUID.class), row.getObject("use_case_id", UUID.class),
					row.getObject("solution_id", UUID.class), row.getString("ai_bucket"),
					row.getString("expected_bucket"), places(row.getString("requirements")), row.getString("note"),
					row.getObject("account_id", UUID.class), row.getTimestamp("created_at").toInstant(),
					row.getBoolean("current")))
			.list();
	}

	private static List<Integer> places(@Nullable String joined) {
		return joined == null || joined.isEmpty() ? List.of()
				: Arrays.stream(joined.split(",")).map(Integer::valueOf).toList();
	}

}
