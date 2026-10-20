package ai.genaifund.beyondpilot.matching.persistence;

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
 * The rows of a program's evaluation (BEY-234): its runs with their steps, and the assessments of its candidates. An
 * assessment is never changed; a new one is added, and the latest of a candidate is its current one.
 */
@Repository
public class EvaluationRepository {

	/** A run queued because a submission, a use case or a brief changed. */
	public static final String BY_CHANGE = "change";

	/** A run started by an operator. */
	public static final String BY_OPERATOR = "operator";

	public static final String CANDIDATES = "candidates";

	public static final String ASSESSMENT = "assessment";

	private static final List<String> STEPS = List.of(CANDIDATES, ASSESSMENT);

	private static final TypeReference<List<Map<String, Object>>> RECORDS = new TypeReference<>() {
	};

	private final JdbcClient jdbc;

	private final JsonMapper json;

	EvaluationRepository(JdbcClient jdbc, JsonMapper json) {
		this.jdbc = jdbc;
		this.json = json;
	}

	/** A run the worker took. */
	public record Run(UUID id, UUID programId, int stalls, boolean assessAll) {
	}

	/** The last run of a program, as its board shows it. */
	public record RunState(UUID id, String state, String origin, @Nullable String modelName, @Nullable String failure,
			int assessed, int total, Instant createdAt, @Nullable Instant startedAt, @Nullable Instant endedAt,
			@Nullable Instant notBefore, @Nullable Instant resumeAt) {
	}

	/** What a run did in one step, and what it cost. */
	public record Step(String name, int takenIn, int givenOut, int calls, long inputTokens, long outputTokens,
			long millis) {
	}

	/** A candidate's current assessment, as the next run compares with it. */
	public record Latest(String fingerprint, String tier, List<Map<String, Object>> records) {
	}

	/**
	 * One assessment as it is added.
	 * @param records the records read: kind, id, version or the time it was sent
	 * @param notes why, concern, next, rationale, contradictions, questions, and what alignment and the sources said
	 */
	public record Assessment(UUID programId, UUID organizationId, UUID solutionId, List<Map<String, Object>> records,
			String fingerprint, String tier, String alignment, boolean provisional, Map<String, Object> notes,
			List<Map<String, Object>> criteria, Map<String, Object> gate, List<Map<String, Object>> coverage,
			@Nullable String changeNote, UUID runId, String modelName, int promptVersion) {
	}

	/** An assessment as the board reads it. */
	public record Assessed(UUID id, UUID organizationId, UUID solutionId, String records, String tier,
			String alignment, boolean provisional, String notes, String criteria, String gate, String coverage,
			@Nullable String changeNote, String modelName, Instant assessedAt) {
	}

	/**
	 * Queues a run for the program, unless one of its runs has not ended.
	 * @return the new run, or empty when one is queued, running or waiting already
	 */
	public Optional<UUID> queue(UUID programId, String origin, @Nullable UUID accountId, int promptVersion,
			@Nullable Instant notBefore, boolean assessAll) {
		return jdbc.sql("""
				insert into evaluation_run (program_id, origin, started_by_account_id, prompt_version, not_before,
				    assess_all)
				values (:programId, :origin, :accountId, :promptVersion, :notBefore, :assessAll)
				on conflict (program_id) where state in ('queued', 'running', 'waiting') do nothing
				returning id
				""")
			.param("programId", programId)
			.param("origin", origin)
			.param("accountId", accountId, Types.OTHER)
			.param("promptVersion", promptVersion)
			.param("notBefore", notBefore == null ? null : Timestamp.from(notBefore), Types.TIMESTAMP)
			.param("assessAll", assessAll)
			.query(UUID.class)
			.optional();
	}

	/**
	 * Moves the start of the run a change queued, because the program changed again.
	 * @return whether such a run was waiting to start
	 */
	public boolean postpone(UUID programId, Instant notBefore) {
		return jdbc.sql("""
				update evaluation_run set not_before = :notBefore
				where program_id = :programId and state = 'queued' and origin = 'change'
				""").param("notBefore", Timestamp.from(notBefore)).param("programId", programId).update() > 0;
	}

	/**
	 * Lets a queued run start at once, and assess everything again when the operator asked so.
	 * @return whether a run of the program was queued
	 */
	public boolean startNow(UUID programId, boolean assessAll) {
		return jdbc.sql("""
				update evaluation_run set not_before = null, assess_all = assess_all or :assessAll
				where program_id = :programId and state = 'queued'
				""").param("assessAll", assessAll).param("programId", programId).update() > 0;
	}

	/** How many runs a change queued for the program since the day began (UTC). */
	public int queuedToday(UUID programId) {
		return jdbc.sql("""
				select count(*) from evaluation_run
				where program_id = :programId and origin = 'change' and created_at >= date_trunc('day', now())
				""").param("programId", programId).query(Integer.class).single();
	}

	/** Takes the run that has waited longest, queued and due or done waiting; it is running from then on. */
	public Optional<Run> claim() {
		return jdbc.sql("""
				update evaluation_run
				set state = 'running', started_at = coalesce(started_at, now()), resume_at = null
				where id = (select r.id from evaluation_run r
				            where (r.state = 'queued' and (r.not_before is null or r.not_before <= now()))
				               or (r.state = 'waiting' and r.resume_at <= now())
				            order by r.created_at, r.id
				            limit 1
				            for update skip locked)
				returning id, program_id, stalls, assess_all
				""")
			.query((row, number) -> new Run(row.getObject("id", UUID.class), row.getObject("program_id", UUID.class),
					row.getInt("stalls"), row.getBoolean("assess_all")))
			.optional();
	}

	/** Queues again the runs a stopped application left running, so that they continue. */
	public int requeueInterrupted() {
		return jdbc.sql("update evaluation_run set state = 'queued' where state = 'running'").update();
	}

	/** Notes the model a run assesses with. */
	public void assessedWith(UUID runId, String modelName) {
		jdbc.sql("update evaluation_run set model_name = :modelName where id = :id")
			.param("modelName", modelName)
			.param("id", runId)
			.update();
	}

	/** Starts counting a pass of the run over its candidates. */
	public void gathered(UUID runId, int total) {
		jdbc.sql("update evaluation_run set total = :total, assessed = 0 where id = :id")
			.param("total", total)
			.param("id", runId)
			.update();
	}

	/** One more candidate of the run was assessed, or found unchanged. */
	public void counted(UUID runId) {
		jdbc.sql("update evaluation_run set assessed = assessed + 1 where id = :id").param("id", runId).update();
	}

	/** Adds what a pass of a run did in a step to what the step holds. */
	public void addToStep(UUID runId, Step step) {
		jdbc.sql("""
				insert into evaluation_run_step (run_id, name, position, taken_in, given_out, calls, input_tokens,
				    output_tokens, millis)
				values (:runId, :name, :position, :takenIn, :givenOut, :calls, :inputTokens, :outputTokens, :millis)
				on conflict (run_id, name) do update
				set taken_in = excluded.taken_in,
				    given_out = case when excluded.name = 'assessment'
				                     then evaluation_run_step.given_out + excluded.given_out
				                     else excluded.given_out end,
				    calls = evaluation_run_step.calls + excluded.calls,
				    input_tokens = evaluation_run_step.input_tokens + excluded.input_tokens,
				    output_tokens = evaluation_run_step.output_tokens + excluded.output_tokens,
				    millis = evaluation_run_step.millis + excluded.millis
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

	/** The run ended with every candidate assessed. */
	public void finish(UUID runId) {
		jdbc.sql("""
				update evaluation_run set state = 'done', ended_at = now(), stalls = 0, failure = null where id = :id
				""").param("id", runId).update();
	}

	/**
	 * The run ended without finishing.
	 * @param failure the kind of failure, never a provider's message
	 */
	public void fail(UUID runId, String failure) {
		jdbc.sql("update evaluation_run set state = 'failed', ended_at = now(), failure = :failure where id = :id")
			.param("failure", failure)
			.param("id", runId)
			.update();
	}

	/** The run stops until a moment, and continues then. */
	public void waitUntil(UUID runId, Instant resumeAt, int stalls, String failure) {
		jdbc.sql("""
				update evaluation_run set state = 'waiting', resume_at = :resumeAt, stalls = :stalls, failure = :failure
				where id = :id
				""")
			.param("resumeAt", Timestamp.from(resumeAt))
			.param("stalls", stalls)
			.param("failure", failure)
			.param("id", runId)
			.update();
	}

	/** The last run of a program; empty when it never had one. */
	public Optional<RunState> lastRun(UUID programId) {
		return jdbc.sql("""
				select id, state, origin, model_name, failure, assessed, total, created_at, started_at, ended_at,
				    not_before, resume_at
				from evaluation_run where program_id = :programId
				order by created_at desc, id
				limit 1
				""")
			.param("programId", programId)
			.query((row, number) -> new RunState(row.getObject("id", UUID.class), row.getString("state"),
					row.getString("origin"), row.getString("model_name"), row.getString("failure"),
					row.getInt("assessed"), row.getInt("total"), row.getTimestamp("created_at").toInstant(),
					instant(row.getTimestamp("started_at")), instant(row.getTimestamp("ended_at")),
					instant(row.getTimestamp("not_before")), instant(row.getTimestamp("resume_at"))))
			.optional();
	}

	/** What a run did in each step, in their order. */
	public List<Step> steps(UUID runId) {
		return jdbc.sql("""
				select name, taken_in, given_out, calls, input_tokens, output_tokens, millis from evaluation_run_step
				where run_id = :runId order by position
				""")
			.param("runId", runId)
			.query((row, number) -> new Step(row.getString("name"), row.getInt("taken_in"), row.getInt("given_out"),
					row.getInt("calls"), row.getLong("input_tokens"), row.getLong("output_tokens"),
					row.getLong("millis")))
			.list();
	}

	/** The current assessment of each candidate of a program, by organization and solution. */
	public Map<List<UUID>, Latest> latest(UUID programId) {
		Map<List<UUID>, Latest> latest = new LinkedHashMap<>();
		jdbc.sql("""
				select distinct on (organization_id, solution_id) organization_id, solution_id, fingerprint, tier,
				    cast(records as text) as records
				from evaluation_assessment where program_id = :programId
				order by organization_id, solution_id, assessed_at desc, id
				""").param("programId", programId).query(row -> {
			latest.put(List.of(row.getObject("organization_id", UUID.class), row.getObject("solution_id", UUID.class)),
					new Latest(row.getString("fingerprint"), row.getString("tier"),
							json.readValue(row.getString("records"), RECORDS)));
		});
		return latest;
	}

	/** Adds an assessment; a second one of the same candidate in the same run is not added. */
	public void add(Assessment assessment) {
		jdbc.sql("""
				insert into evaluation_assessment (program_id, organization_id, solution_id, records, fingerprint, tier,
				    alignment, provisional, notes, criteria, gate, coverage, change_note, run_id, model_name,
				    prompt_version)
				values (:programId, :organizationId, :solutionId, cast(:records as jsonb), :fingerprint, :tier,
				    :alignment, :provisional, cast(:notes as jsonb), cast(:criteria as jsonb), cast(:gate as jsonb),
				    cast(:coverage as jsonb), :changeNote, :runId, :modelName, :promptVersion)
				on conflict (program_id, organization_id, solution_id, run_id) do nothing
				""")
			.param("programId", assessment.programId())
			.param("organizationId", assessment.organizationId())
			.param("solutionId", assessment.solutionId())
			.param("records", json.writeValueAsString(assessment.records()))
			.param("fingerprint", assessment.fingerprint())
			.param("tier", assessment.tier())
			.param("alignment", assessment.alignment())
			.param("provisional", assessment.provisional())
			.param("notes", json.writeValueAsString(assessment.notes()))
			.param("criteria", json.writeValueAsString(assessment.criteria()))
			.param("gate", json.writeValueAsString(assessment.gate()))
			.param("coverage", json.writeValueAsString(assessment.coverage()))
			.param("changeNote", assessment.changeNote(), Types.VARCHAR)
			.param("runId", assessment.runId())
			.param("modelName", assessment.modelName())
			.param("promptVersion", assessment.promptVersion())
			.update();
	}

	/** The current assessment of every candidate of a program, the latest assessed first. */
	public List<Assessed> current(UUID programId) {
		return jdbc.sql("""
				select id, organization_id, solution_id, cast(records as text) as records, tier, alignment, provisional,
				    cast(notes as text) as notes, cast(criteria as text) as criteria, cast(gate as text) as gate,
				    cast(coverage as text) as coverage, change_note, model_name, assessed_at
				from (select distinct on (organization_id, solution_id) * from evaluation_assessment
				      where program_id = :programId
				      order by organization_id, solution_id, assessed_at desc, id) c
				order by assessed_at desc, id
				""")
			.param("programId", programId)
			.query((row, number) -> new Assessed(row.getObject("id", UUID.class),
					row.getObject("organization_id", UUID.class), row.getObject("solution_id", UUID.class),
					row.getString("records"), row.getString("tier"), row.getString("alignment"),
					row.getBoolean("provisional"), row.getString("notes"), row.getString("criteria"),
					row.getString("gate"), row.getString("coverage"), row.getString("change_note"),
					row.getString("model_name"), row.getTimestamp("assessed_at").toInstant()))
			.list();
	}

	private static @Nullable Instant instant(@Nullable Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant();
	}

}
