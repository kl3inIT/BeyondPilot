package ai.genaifund.beyondpilot.matching.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * The rows of matching: the requirements of a use case, its runs with their steps, and its candidates. A statement
 * here is one change; the caller's transaction joins those that belong together.
 */
@Repository
public class MatchingRepository {

	public static final String CAPABILITY = "capability";

	public static final String CONSTRAINT = "constraint";

	public static final String REQUIRED = "required";

	public static final String OPTIONAL = "optional";

	/** A run started because the use case was approved or changed. */
	public static final String BY_APPROVAL = "approved";

	/** A run started by an operator. */
	public static final String BY_OPERATOR = "operator";

	/** A run started by a member of the use case's organization. */
	public static final String BY_MEMBER = "member";

	public static final String SHORTLISTED = "shortlisted";

	public static final String REMOVED = "removed";

	public static final String RESTORED = "restored";

	/** A candidate nobody decided on, or one that was restored. */
	public static final String UNDECIDED = "none";

	/** A candidate a run found. */
	public static final String RECOMMENDED = "recommended";

	/** A candidate an operator put there by hand. */
	public static final String ADDED = "added";

	/** The state of a run the worker took and has not ended or put to wait. */
	public static final String RUNNING = "running";

	public static final String REQUIREMENTS = "requirements";

	public static final String CANDIDATES = "candidates";

	public static final String JUDGMENT = "judgment";

	/** The steps of a run, in their order. */
	private static final List<String> STEPS = List.of(REQUIREMENTS, CANDIDATES, JUDGMENT);

	private final JdbcClient jdbc;

	private final JsonMapper json;

	MatchingRepository(JdbcClient jdbc, JsonMapper json) {
		this.jdbc = jdbc;
		this.json = json;
	}

	/**
	 * One thing a use case asks for.
	 * @param position its place in the list, from 1; a finding names it as R1, R2 and so on
	 * @param kind {@link #CAPABILITY} or {@link #CONSTRAINT}
	 * @param necessity {@link #REQUIRED} or {@link #OPTIONAL}
	 * @param quote the words of the brief it comes from
	 * @param label two or three words it is shown by in a list; empty for one read before labels were kept
	 */
	public record Requirement(int position, String kind, String necessity, String statement, String quote,
			String label) {

		public boolean isCapability() {
			return CAPABILITY.equals(kind);
		}

		public boolean isRequired() {
			return REQUIRED.equals(necessity);
		}

		/** How the model is told of it and names it back. */
		public String name() {
			return "R" + position;
		}

	}

	/**
	 * A run the worker took.
	 * @param judgeAll whether every candidate is judged again, whatever was judged before
	 */
	public record Run(UUID id, UUID useCaseId, int stalls, boolean judgeAll) {
	}

	/**
	 * What operators set.
	 * @param runsPerDay how many runs a day start in all; null is no limit
	 */
	public record Settings(int settleMinutes, int editRunsPerDay, int memberRunsPerDay, @Nullable Integer runsPerDay,
			int candidates, long version) {
	}

	/** A run as people see it. */
	public record RunState(UUID id, String state, String origin, @Nullable String modelName, @Nullable String failure,
			Instant createdAt, @Nullable Instant startedAt, @Nullable Instant endedAt, @Nullable Instant notBefore,
			@Nullable Instant resumeAt) {
	}

	/**
	 * A candidate with what people last decided on it.
	 * @param decision {@link #SHORTLISTED}, {@link #REMOVED} or {@link #UNDECIDED}
	 * @param decidedByOperator whether the last decision was an operator's
	 * @param decidedBy who decided last; null when nobody decided
	 */
	public record Candidate(UUID id, UUID useCaseId, UUID solutionId, String origin, @Nullable Integer foundAt,
			String bucket, int requiredMet, int requiredTotal, Map<String, Object> findings, @Nullable String summary,
			List<String> unread, boolean judged, String decision, @Nullable String reason, @Nullable String note,
			boolean decidedByOperator, @Nullable UUID decidedBy, @Nullable Instant decidedAt) {
	}

	/**
	 * What a run did in one step, to add to what the step holds.
	 * @param takenIn how many the step was given
	 * @param givenOut how many it produced
	 */
	public record Step(String name, int takenIn, int givenOut, int calls, long inputTokens, long outputTokens,
			long millis) {
	}

	/**
	 * What a run found for one candidate.
	 * @param findings the answer per requirement and for the industry and the technology, as it is stored
	 * @param unread the sources that held no text
	 * @param fingerprint what was judged
	 */
	public record Judged(String bucket, int requiredMet, int requiredTotal, Map<String, Object> findings,
			@Nullable String summary, List<String> unread, String fingerprint) {
	}

	/** The requirements kept for a use case, in their order; none when it was never read. */
	public List<Requirement> requirements(UUID useCaseId) {
		return jdbc.sql("""
				select position, kind, necessity, statement, quote, label from matching_requirement
				where use_case_id = :useCaseId
				order by position
				""")
			.param("useCaseId", useCaseId)
			.query((row, number) -> new Requirement(row.getInt("position"), row.getString("kind"),
					row.getString("necessity"), row.getString("statement"), row.getString("quote"),
					row.getString("label")))
			.list();
	}

	/** What the requirements kept for a use case were extracted from; empty when none is kept. */
	public Optional<String> requirementsSource(UUID useCaseId) {
		return jdbc.sql("select source_hash from matching_requirement where use_case_id = :useCaseId limit 1")
			.param("useCaseId", useCaseId)
			.query(String.class)
			.optional();
	}

	/** Puts these requirements in the place of those kept for the use case. */
	public void replaceRequirements(UUID useCaseId, String sourceHash, List<Requirement> requirements) {
		jdbc.sql("delete from matching_requirement where use_case_id = :useCaseId")
			.param("useCaseId", useCaseId)
			.update();
		for (Requirement requirement : requirements) {
			jdbc.sql("""
					insert into matching_requirement (use_case_id, position, kind, necessity, statement, quote, label,
					    source_hash)
					values (:useCaseId, :position, :kind, :necessity, :statement, :quote, :label, :sourceHash)
					""")
				.param("useCaseId", useCaseId)
				.param("position", requirement.position())
				.param("kind", requirement.kind())
				.param("necessity", requirement.necessity())
				.param("statement", requirement.statement())
				.param("quote", requirement.quote())
				.param("label", requirement.label())
				.param("sourceHash", sourceHash)
				.update();
		}
	}

	/**
	 * Queues a run for the use case, unless one of its runs has not ended.
	 * @return the new run, or empty when one is queued, running or waiting already
	 */
	public Optional<UUID> queue(UUID useCaseId, String origin, @Nullable UUID accountId, int promptVersion,
			@Nullable Instant notBefore, boolean judgeAll) {
		return jdbc.sql("""
				insert into matching_run (use_case_id, origin, started_by_account_id, prompt_version, not_before, judge_all)
				values (:useCaseId, :origin, :accountId, :promptVersion, :notBefore, :judgeAll)
				on conflict (use_case_id) where state in ('queued', 'running', 'waiting') do nothing
				returning id
				""")
			.param("useCaseId", useCaseId)
			.param("origin", origin)
			.param("accountId", accountId, Types.OTHER)
			.param("promptVersion", promptVersion)
			.param("notBefore", notBefore == null ? null : Timestamp.from(notBefore), Types.TIMESTAMP)
			.param("judgeAll", judgeAll)
			.query(UUID.class)
			.optional();
	}

	/**
	 * Moves the start of the run a change of the use case queued, because the use case changed again.
	 * @return whether such a run was waiting to start
	 */
	public boolean postpone(UUID useCaseId, Instant notBefore) {
		return jdbc.sql("""
				update matching_run set not_before = :notBefore
				where use_case_id = :useCaseId and state = 'queued' and origin = 'approved'
				""")
			.param("notBefore", Timestamp.from(notBefore))
			.param("useCaseId", useCaseId)
			.update() > 0;
	}

	/**
	 * Lets the run a change queued start at once, because a person asked for a run.
	 * @return whether a run was waiting for its moment; a run that is only waiting for the worker is not
	 */
	public boolean startNow(UUID useCaseId) {
		return jdbc.sql("""
				update matching_run set not_before = null
				where use_case_id = :useCaseId and state = 'queued' and not_before is not null
				""").param("useCaseId", useCaseId).update() > 0;
	}

	/** How many runs of one origin were queued for the use case since the day began (UTC). */
	public int queuedToday(UUID useCaseId, String origin) {
		return jdbc.sql("""
				select count(*) from matching_run
				where use_case_id = :useCaseId and origin = :origin and created_at >= date_trunc('day', now())
				""").param("useCaseId", useCaseId).param("origin", origin).query(Integer.class).single();
	}

	/** What operators set. */
	public Settings settings() {
		return jdbc.sql("""
				select settle_minutes, edit_runs_per_day, member_runs_per_day, runs_per_day, candidates, version
				from matching_settings
				""")
			.query((row, number) -> new Settings(row.getInt("settle_minutes"), row.getInt("edit_runs_per_day"),
					row.getInt("member_runs_per_day"), (Integer) row.getObject("runs_per_day"),
					row.getInt("candidates"), row.getLong("version")))
			.single();
	}

	/**
	 * Keeps what an operator set, when nobody changed it since they read it.
	 * @return whether it was kept
	 */
	public boolean saveSettings(Settings settings) {
		return jdbc.sql("""
				update matching_settings
				set settle_minutes = :settleMinutes, edit_runs_per_day = :editRunsPerDay,
				    member_runs_per_day = :memberRunsPerDay, runs_per_day = :runsPerDay, candidates = :candidates,
				    version = version + 1, updated_at = now()
				where version = :version
				""")
			.param("settleMinutes", settings.settleMinutes())
			.param("editRunsPerDay", settings.editRunsPerDay())
			.param("memberRunsPerDay", settings.memberRunsPerDay())
			.param("runsPerDay", settings.runsPerDay(), Types.INTEGER)
			.param("candidates", settings.candidates())
			.param("version", settings.version())
			.update() == 1;
	}

	/** Whether a run of the use case ended with everything judged. A failed run does not count: it left work undone. */
	public boolean hasFinishedRun(UUID useCaseId) {
		return jdbc.sql("select exists (select 1 from matching_run where use_case_id = :useCaseId and state = 'done')")
			.param("useCaseId", useCaseId)
			.query(Boolean.class)
			.single();
	}

	/**
	 * Takes the run that has waited longest: one queued whose time has come, or one whose wait is over. It is running
	 * from then on. A run that never started is left queued while as many runs as a day allows have started today.
	 * @param runsPerDay how many runs may start in a day (UTC); null is no limit
	 */
	public Optional<Run> claim(@Nullable Integer runsPerDay) {
		return jdbc.sql("""
				update matching_run
				set state = 'running', started_at = coalesce(started_at, now()), resume_at = null
				where id = (select r.id from matching_run r
				            where ((r.state = 'queued' and (r.not_before is null or r.not_before <= now()))
				                   or (r.state = 'waiting' and r.resume_at <= now()))
				              and (cast(:runsPerDay as integer) is null or r.started_at is not null
				                   or (select count(*) from matching_run s
				                       where s.started_at >= date_trunc('day', now())) < cast(:runsPerDay as integer))
				            order by r.created_at, r.id
				            limit 1
				            for update skip locked)
				returning id, use_case_id, stalls, judge_all
				""")
			.param("runsPerDay", runsPerDay, Types.INTEGER)
			.query((row, number) -> new Run(row.getObject("id", UUID.class), row.getObject("use_case_id", UUID.class),
					row.getInt("stalls"), row.getBoolean("judge_all")))
			.optional();
	}

	/** The last run of a use case; empty when it never had one. */
	public Optional<RunState> lastRun(UUID useCaseId) {
		return jdbc.sql("""
				select id, state, origin, model_name, failure, created_at, started_at, ended_at, not_before, resume_at
				from matching_run where use_case_id = :useCaseId
				order by created_at desc, id
				limit 1
				""")
			.param("useCaseId", useCaseId)
			.query((row, number) -> new RunState(row.getObject("id", UUID.class), row.getString("state"),
					row.getString("origin"), row.getString("model_name"), row.getString("failure"),
					row.getTimestamp("created_at").toInstant(), instant(row.getTimestamp("started_at")),
					instant(row.getTimestamp("ended_at")), instant(row.getTimestamp("not_before")),
					instant(row.getTimestamp("resume_at"))))
			.optional();
	}

	/** What a run did in each step, in their order. */
	public List<Step> steps(UUID runId) {
		return jdbc.sql("""
				select name, taken_in, given_out, calls, input_tokens, output_tokens, millis from matching_run_step
				where run_id = :runId order by position
				""")
			.param("runId", runId)
			.query((row, number) -> new Step(row.getString("name"), row.getInt("taken_in"), row.getInt("given_out"),
					row.getInt("calls"), row.getLong("input_tokens"), row.getLong("output_tokens"),
					row.getLong("millis")))
			.list();
	}

	private static @Nullable Instant instant(@Nullable Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant();
	}

	/**
	 * Queues again the runs a stopped application left running, so that they continue.
	 * @return how many
	 */
	public int requeueInterrupted() {
		return jdbc.sql("update matching_run set state = 'queued' where state = 'running'").update();
	}

	/** Notes the model a run judges with. */
	public void judgedWith(UUID runId, String modelName) {
		jdbc.sql("update matching_run set model_name = :modelName where id = :id")
			.param("modelName", modelName)
			.param("id", runId)
			.update();
	}

	/**
	 * Adds what a run did in a step to what the step holds. A run that continues judges more candidates, which are
	 * added; what the other steps gave out is what the last pass gave.
	 */
	public void addToStep(UUID runId, Step step) {
		jdbc.sql("""
				insert into matching_run_step (run_id, name, position, taken_in, given_out, calls, input_tokens,
				    output_tokens, millis)
				values (:runId, :name, :position, :takenIn, :givenOut, :calls, :inputTokens, :outputTokens, :millis)
				on conflict (run_id, name) do update
				set taken_in = excluded.taken_in,
				    given_out = case when excluded.name = 'judgment'
				                     then matching_run_step.given_out + excluded.given_out
				                     else excluded.given_out end,
				    calls = matching_run_step.calls + excluded.calls,
				    input_tokens = matching_run_step.input_tokens + excluded.input_tokens,
				    output_tokens = matching_run_step.output_tokens + excluded.output_tokens,
				    millis = matching_run_step.millis + excluded.millis
				""")
			.param("runId", runId)
			.param("name", step.name())
			.param("position", STEPS.indexOf(step.name()) + 1)
			.param("takenIn", step.takenIn())
			.param("givenOut", step.givenOut())
			.param("calls", step.calls())
			.param("inputTokens", step.inputTokens())
			.param("outputTokens", step.outputTokens())
			.param("millis", step.millis())
			.update();
	}

	/** The run ended with everything judged. */
	public void finish(UUID runId) {
		jdbc.sql("""
				update matching_run set state = 'done', ended_at = now(), stalls = 0, failure = null where id = :id
				""").param("id", runId).update();
	}

	/**
	 * The run ended without finishing.
	 * @param failure the kind of failure, never a provider's message
	 */
	public void fail(UUID runId, String failure) {
		jdbc.sql("update matching_run set state = 'failed', ended_at = now(), failure = :failure where id = :id")
			.param("failure", failure)
			.param("id", runId)
			.update();
	}

	/**
	 * The run stops until a moment, and continues then.
	 * @param stalls how many times in a row it stopped without judging anything
	 * @param failure the kind of failure that stopped it
	 */
	public void waitUntil(UUID runId, Instant resumeAt, int stalls, String failure) {
		jdbc.sql("""
				update matching_run set state = 'waiting', resume_at = :resumeAt, stalls = :stalls, failure = :failure
				where id = :id
				""")
			.param("resumeAt", Timestamp.from(resumeAt))
			.param("stalls", stalls)
			.param("failure", failure)
			.param("id", runId)
			.update();
	}

	/**
	 * Keeps what a run found: these solutions are the use case's recommended candidates, in this order. A candidate
	 * the run no longer finds is taken out, unless a person added it or decided on it; then it only loses its place.
	 */
	public void found(UUID useCaseId, List<UUID> solutions) {
		jdbc.sql("update matching_candidate set found_at = null where use_case_id = :useCaseId")
			.param("useCaseId", useCaseId)
			.update();
		for (int place = 0; place < solutions.size(); place++) {
			jdbc.sql("""
					insert into matching_candidate (use_case_id, solution_id, origin, found_at)
					values (:useCaseId, :solutionId, 'recommended', :foundAt)
					on conflict (use_case_id, solution_id) do update set found_at = excluded.found_at
					""")
				.param("useCaseId", useCaseId)
				.param("solutionId", solutions.get(place))
				.param("foundAt", place + 1)
				.update();
		}
		jdbc.sql("""
				delete from matching_candidate c
				where c.use_case_id = :useCaseId and c.found_at is null and c.origin = 'recommended'
				  and not exists (select 1 from matching_decision d where d.candidate_id = c.id)
				""").param("useCaseId", useCaseId).update();
	}

	/** What was judged for each candidate of a use case that has a judgment, by solution. */
	public Map<UUID, String> fingerprints(UUID useCaseId) {
		Map<UUID, String> fingerprints = new LinkedHashMap<>();
		jdbc.sql("""
				select solution_id, fingerprint from matching_candidate
				where use_case_id = :useCaseId and fingerprint is not null
				""").param("useCaseId", useCaseId).query(row -> {
			fingerprints.put(row.getObject("solution_id", UUID.class), row.getString("fingerprint"));
		});
		return fingerprints;
	}

	/** Keeps the judgment of one candidate. */
	public void judged(UUID useCaseId, UUID solutionId, UUID runId, Judged judged) {
		jdbc.sql("""
				update matching_candidate
				set bucket = :bucket, required_met = :requiredMet, required_total = :requiredTotal,
				    findings = cast(:findings as jsonb), summary = :summary, unread = string_to_array(:unread, ','),
				    fingerprint = :fingerprint, run_id = :runId, judged_at = now()
				where use_case_id = :useCaseId and solution_id = :solutionId
				""")
			.param("bucket", judged.bucket())
			.param("requiredMet", judged.requiredMet())
			.param("requiredTotal", judged.requiredTotal())
			.param("findings", json.writeValueAsString(judged.findings()))
			.param("summary", judged.summary(), Types.VARCHAR)
			.param("unread", String.join(",", judged.unread()))
			.param("fingerprint", judged.fingerprint())
			.param("runId", runId)
			.param("useCaseId", useCaseId)
			.param("solutionId", solutionId)
			.update();
	}

	private static final String CANDIDATE = """
			select c.id, c.use_case_id, c.solution_id, c.origin, c.found_at, c.bucket, c.required_met, c.required_total,
			       cast(c.findings as text) as findings, c.summary, array_to_string(c.unread, ',') as unread,
			       c.judged_at is not null as judged, d.kind, d.reason, d.note, coalesce(d.by_operator, false) as by_operator,
			       d.account_id, d.created_at as decided_at
			from matching_candidate c
			left join lateral (select kind, reason, note, by_operator, account_id, created_at from matching_decision
			                   where candidate_id = c.id
			                   order by created_at desc, id
			                   limit 1) d on true
			""";

	/** The candidates of a use case with what people last decided, in the order the last run found them. */
	public List<Candidate> candidates(UUID useCaseId) {
		return jdbc.sql(CANDIDATE + "where c.use_case_id = :useCaseId order by c.found_at nulls last, c.created_at, c.id")
			.param("useCaseId", useCaseId)
			.query((row, number) -> candidate(row))
			.list();
	}

	/** One candidate with what people last decided. */
	public Optional<Candidate> candidate(UUID id) {
		return jdbc.sql(CANDIDATE + "where c.id = :id").param("id", id).query((row, number) -> candidate(row)).optional();
	}

	private Candidate candidate(ResultSet row) throws SQLException {
		String kind = row.getString("kind");
		boolean removed = REMOVED.equals(kind);
		String unread = row.getString("unread");
		return new Candidate(row.getObject("id", UUID.class), row.getObject("use_case_id", UUID.class),
				row.getObject("solution_id", UUID.class), row.getString("origin"), (Integer) row.getObject("found_at"),
				row.getString("bucket"), row.getInt("required_met"), row.getInt("required_total"),
				json.readValue(row.getString("findings"), new TypeReference<Map<String, Object>>() {
				}), row.getString("summary"), unread == null || unread.isEmpty() ? List.of() : List.of(unread.split(",")),
				row.getBoolean("judged"), SHORTLISTED.equals(kind) || removed ? kind : UNDECIDED,
				removed ? row.getString("reason") : null, removed ? row.getString("note") : null,
				row.getBoolean("by_operator"), row.getObject("account_id", UUID.class),
				instant(row.getTimestamp("decided_at")));
	}

	/** The solutions an operator put among the candidates of a use case by hand. */
	public List<UUID> addedSolutions(UUID useCaseId) {
		return jdbc.sql("select solution_id from matching_candidate where use_case_id = :useCaseId and origin = 'added'")
			.param("useCaseId", useCaseId)
			.query(UUID.class)
			.list();
	}

	/**
	 * Puts a solution among the candidates of a use case by hand.
	 * @return the new candidate, or empty when the solution is a candidate already
	 */
	public Optional<UUID> add(UUID useCaseId, UUID solutionId, UUID accountId) {
		return jdbc.sql("""
				insert into matching_candidate (use_case_id, solution_id, origin, added_by_account_id)
				values (:useCaseId, :solutionId, 'added', :accountId)
				on conflict (use_case_id, solution_id) do nothing
				returning id
				""")
			.param("useCaseId", useCaseId)
			.param("solutionId", solutionId)
			.param("accountId", accountId)
			.query(UUID.class)
			.optional();
	}

	/**
	 * Records what a person decided on a candidate. Decisions are only added; the last one is the candidate's state.
	 * @param kind {@link #SHORTLISTED}, {@link #REMOVED} or {@link #RESTORED}
	 */
	public void decide(UUID candidateId, String kind, @Nullable String reason, @Nullable String note, UUID accountId,
			boolean byOperator) {
		jdbc.sql("""
				insert into matching_decision (candidate_id, kind, reason, note, account_id, by_operator)
				values (:candidateId, :kind, :reason, :note, :accountId, :byOperator)
				""")
			.param("candidateId", candidateId)
			.param("kind", kind)
			.param("reason", reason, Types.VARCHAR)
			.param("note", note, Types.VARCHAR)
			.param("accountId", accountId)
			.param("byOperator", byOperator)
			.update();
	}

}
