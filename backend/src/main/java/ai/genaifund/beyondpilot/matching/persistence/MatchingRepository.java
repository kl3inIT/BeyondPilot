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

	/** A run started by a person. */
	public static final String BY_OPERATOR = "operator";

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
	 */
	public record Requirement(int position, String kind, String necessity, String statement, String quote) {

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

	/** A run the worker took. */
	public record Run(UUID id, UUID useCaseId, int stalls) {
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
				select position, kind, necessity, statement, quote from matching_requirement
				where use_case_id = :useCaseId
				order by position
				""")
			.param("useCaseId", useCaseId)
			.query((row, number) -> new Requirement(row.getInt("position"), row.getString("kind"),
					row.getString("necessity"), row.getString("statement"), row.getString("quote")))
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
					insert into matching_requirement (use_case_id, position, kind, necessity, statement, quote, source_hash)
					values (:useCaseId, :position, :kind, :necessity, :statement, :quote, :sourceHash)
					""")
				.param("useCaseId", useCaseId)
				.param("position", requirement.position())
				.param("kind", requirement.kind())
				.param("necessity", requirement.necessity())
				.param("statement", requirement.statement())
				.param("quote", requirement.quote())
				.param("sourceHash", sourceHash)
				.update();
		}
	}

	/**
	 * Queues a run for the use case, unless one of its runs has not ended.
	 * @return the new run, or empty when one is queued, running or waiting already
	 */
	public Optional<UUID> queue(UUID useCaseId, String origin, @Nullable UUID accountId, int promptVersion) {
		return jdbc.sql("""
				insert into matching_run (use_case_id, origin, started_by_account_id, prompt_version)
				values (:useCaseId, :origin, :accountId, :promptVersion)
				on conflict (use_case_id) where state in ('queued', 'running', 'waiting') do nothing
				returning id
				""")
			.param("useCaseId", useCaseId)
			.param("origin", origin)
			.param("accountId", accountId, Types.OTHER)
			.param("promptVersion", promptVersion)
			.query(UUID.class)
			.optional();
	}

	/** Whether a run of the use case ended with everything judged. A failed run does not count: it left work undone. */
	public boolean hasFinishedRun(UUID useCaseId) {
		return jdbc.sql("select exists (select 1 from matching_run where use_case_id = :useCaseId and state = 'done')")
			.param("useCaseId", useCaseId)
			.query(Boolean.class)
			.single();
	}

	/**
	 * Takes the run that has waited longest: one queued, or one whose wait is over. It is running from then on.
	 */
	public Optional<Run> claim() {
		return jdbc.sql("""
				update matching_run
				set state = 'running', started_at = coalesce(started_at, now()), resume_at = null
				where id = (select id from matching_run
				            where state = 'queued' or (state = 'waiting' and resume_at <= now())
				            order by created_at, id
				            limit 1
				            for update skip locked)
				returning id, use_case_id, stalls
				""")
			.query((row, number) -> new Run(row.getObject("id", UUID.class), row.getObject("use_case_id", UUID.class),
					row.getInt("stalls")))
			.optional();
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

}
