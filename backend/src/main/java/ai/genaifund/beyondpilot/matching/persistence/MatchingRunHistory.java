package ai.genaifund.beyondpilot.matching.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * The runs of every use case as operators read them (BEY-210), and the group each solution had in each run, kept in
 * {@code matching_judgment} so that two runs of a use case can be told apart.
 */
@Repository
public class MatchingRunHistory {

	private final JdbcClient jdbc;

	MatchingRunHistory(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * One run, newest first in a list.
	 * @param startedBy who started it; null when the use case's approval or a change started it
	 * @param judged how many solutions the run judged itself, from what it kept; null before judgments were kept
	 */
	public record Run(UUID id, UUID useCaseId, String state, String origin, @Nullable UUID startedBy,
			int promptVersion, @Nullable String modelName, @Nullable String failure, Instant createdAt,
			@Nullable Instant startedAt, @Nullable Instant endedAt, @Nullable Integer judged, @Nullable Integer kept) {
	}

	/**
	 * The group a solution had in a run.
	 * @param judged false when the run found its material unchanged and kept the earlier judgment
	 */
	public record Judgment(UUID solutionId, String bucket, int requiredMet, int requiredTotal, boolean judged) {
	}

	private static final String RUN = """
			select r.id, r.use_case_id, r.state, r.origin, r.started_by_account_id, r.prompt_version, r.model_name,
			       r.failure, r.created_at, r.started_at, r.ended_at, j.judged, j.kept
			from matching_run r
			left join lateral (select count(*) filter (where judged)::int as judged,
			                          count(*) filter (where not judged)::int as kept
			                   from matching_judgment where run_id = r.id
			                   having count(*) > 0) j on true
			""";

	/** One page of the runs of every use case, the newest first. */
	public List<Run> runs(int limit, long offset) {
		return jdbc.sql(RUN + "order by r.created_at desc, r.id limit :limit offset :offset")
			.param("limit", limit)
			.param("offset", offset)
			.query((row, number) -> run(row))
			.list();
	}

	/** How many runs there are, over all pages. */
	public long count() {
		return jdbc.sql("select count(*) from matching_run").query(Long.class).single();
	}

	public Optional<Run> run(UUID runId) {
		return jdbc.sql(RUN + "where r.id = :id").param("id", runId).query((row, number) -> run(row)).optional();
	}

	/** The run of the same use case created just before this one; empty for its first. */
	public Optional<UUID> previous(UUID runId) {
		return jdbc.sql("""
				select p.id from matching_run r
				join matching_run p on p.use_case_id = r.use_case_id
				    and (p.created_at, p.id) < (r.created_at, r.id)
				where r.id = :id
				order by p.created_at desc, p.id desc
				limit 1
				""").param("id", runId).query(UUID.class).optional();
	}

	/** The groups a run kept, one per solution; none for a run before judgments were kept. */
	public List<Judgment> judgments(UUID runId) {
		return jdbc.sql("""
				select solution_id, bucket, required_met, required_total, judged from matching_judgment
				where run_id = :runId
				""")
			.param("runId", runId)
			.query((row, number) -> new Judgment(row.getObject("solution_id", UUID.class), row.getString("bucket"),
					row.getInt("required_met"), row.getInt("required_total"), row.getBoolean("judged")))
			.list();
	}

	/**
	 * Keeps the group a candidate has now as its group in a run, after the run judged it ({@code judged}) or found its
	 * material unchanged. A judgment replaces what the run kept before; finding it unchanged never replaces anything,
	 * since a run that continues after a refusal finds unchanged what it judged itself.
	 */
	public void record(UUID runId, UUID useCaseId, UUID solutionId, boolean judged) {
		String conflict = judged ? """
				on conflict (run_id, solution_id) do update
				set bucket = excluded.bucket, required_met = excluded.required_met,
				    required_total = excluded.required_total, judged = true, recorded_at = now()
				""" : "on conflict (run_id, solution_id) do nothing";
		jdbc.sql("""
				insert into matching_judgment (run_id, solution_id, bucket, required_met, required_total, judged)
				select :runId, solution_id, bucket, required_met, required_total, :judged from matching_candidate
				where use_case_id = :useCaseId and solution_id = :solutionId
				""" + conflict)
			.param("runId", runId)
			.param("useCaseId", useCaseId)
			.param("solutionId", solutionId)
			.param("judged", judged)
			.update();
	}

	private static Run run(ResultSet row) throws SQLException {
		Object judged = row.getObject("judged");
		Object kept = row.getObject("kept");
		return new Run(row.getObject("id", UUID.class), row.getObject("use_case_id", UUID.class), row.getString("state"),
				row.getString("origin"), row.getObject("started_by_account_id", UUID.class), row.getInt("prompt_version"),
				row.getString("model_name"), row.getString("failure"), row.getTimestamp("created_at").toInstant(),
				instant(row.getTimestamp("started_at")), instant(row.getTimestamp("ended_at")),
				judged == null ? null : ((Number) judged).intValue(), kept == null ? null : ((Number) kept).intValue());
	}

	private static @Nullable Instant instant(@Nullable Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant();
	}

}
