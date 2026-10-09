package ai.genaifund.beyondpilot.matching;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Judged;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Requirement;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Run;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Step;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What matching keeps, against PostgreSQL: one open run per use case, taken by the worker in the order they were
 * queued, and candidates that a later run replaces without touching what people decided.
 */
// The worker would take the runs this test queues; here it never wakes.
@SpringBootTest(properties = "beyondpilot.matching.interval=PT24H")
@Import(TestcontainersConfiguration.class)
class MatchingRepositoryTest {

	@Autowired
	private MatchingRepository matching;

	@Autowired
	private JdbcClient jdbc;

	@BeforeEach
	void nothingKept() {
		jdbc.sql("delete from matching_candidate").update();
		jdbc.sql("delete from matching_run").update();
		jdbc.sql("delete from matching_requirement").update();
	}

	@Test
	void aUseCaseHasOneOpenRunAndTheWorkerTakesRunsInTheOrderTheyWereQueued() {
		UUID first = UUID.randomUUID();
		UUID second = UUID.randomUUID();
		assertThat(matching.hasRun(first)).isFalse();

		UUID run = matching.queue(first, MatchingRepository.BY_APPROVAL, null, 1).orElseThrow();
		// A second start while one is open is refused, whoever asks.
		assertThat(matching.queue(first, MatchingRepository.BY_OPERATOR, UUID.randomUUID(), 1)).isEmpty();
		jdbc.sql("update matching_run set created_at = now() - interval '1 minute' where id = ?").param(run).update();
		UUID later = matching.queue(second, MatchingRepository.BY_OPERATOR, UUID.randomUUID(), 1).orElseThrow();
		assertThat(matching.hasRun(first)).isTrue();

		Run taken = matching.claim().orElseThrow();
		assertThat(taken).isEqualTo(new Run(run, first, 0));
		assertThat(matching.claim().map(Run::id)).contains(later);
		assertThat(matching.claim()).isEmpty();

		// A run that waits is taken again only when its time has come, and remembers how often it stalled.
		matching.waitUntil(run, Instant.now().plusSeconds(600), 2, "java.lang.IllegalStateException");
		assertThat(matching.claim()).isEmpty();
		assertThat(matching.queue(first, MatchingRepository.BY_OPERATOR, null, 1)).isEmpty();
		matching.waitUntil(run, Instant.now().minusSeconds(1), 2, "java.lang.IllegalStateException");
		assertThat(matching.claim()).contains(new Run(run, first, 2));

		// What a stopped application left running is queued again.
		assertThat(matching.requeueInterrupted()).isEqualTo(2);
		assertThat(matching.claim().map(Run::id)).contains(run);
		matching.finish(run);
		matching.fail(later, MatchingRuns.NO_MODEL);
		assertThat(states()).containsExactlyInAnyOrder("done", "failed");
		// Once its run has ended, a use case can have another.
		assertThat(matching.queue(first, MatchingRepository.BY_OPERATOR, null, 1)).isPresent();
	}

	@Test
	void aStepAddsWhatEachPassJudgedAndKeepsWhatTheLastPassOfTheOthersGave() {
		UUID run = matching.queue(UUID.randomUUID(), MatchingRepository.BY_APPROVAL, null, 1).orElseThrow();
		matching.judgedWith(run, "gpt-test");

		matching.addToStep(run, new Step(MatchingRepository.REQUIREMENTS, 1, 6, 1, 900, 300, 4000));
		matching.addToStep(run, new Step(MatchingRepository.CANDIDATES, 4, 40, 0, 0, 0, 120));
		matching.addToStep(run, new Step(MatchingRepository.JUDGMENT, 40, 12, 12, 60000, 9000, 50000));
		// The run continued: the requirements were kept, so nothing was asked, and 28 more were judged.
		matching.addToStep(run, new Step(MatchingRepository.REQUIREMENTS, 1, 6, 0, 0, 0, 0));
		matching.addToStep(run, new Step(MatchingRepository.JUDGMENT, 40, 28, 29, 140000, 21000, 110000));

		assertThat(jdbc.sql("""
				select name || ' ' || position || ' ' || taken_in || ' ' || given_out || ' ' || calls || ' '
				    || input_tokens || ' ' || output_tokens || ' ' || millis
				from matching_run_step where run_id = ? order by position
				""").param(run).query(String.class).list()).containsExactly("requirements 1 1 6 1 900 300 4000",
				"candidates 2 4 40 0 0 0 120", "judgment 3 40 40 41 200000 30000 160000");
		assertThat(jdbc.sql("select model_name from matching_run where id = ?").param(run).query(String.class).single())
			.isEqualTo("gpt-test");
	}

	@Test
	void requirementsAreReplacedTogetherWithWhatTheyWereReadFrom() {
		UUID useCase = UUID.randomUUID();
		assertThat(matching.requirementsSource(useCase)).isEmpty();

		matching.replaceRequirements(useCase, "hash-1",
				List.of(new Requirement(1, "capability", "required", "Answers calls.", "answer calls"),
						new Requirement(2, "constraint", "optional", "Runs on premises.", "our data centre")));
		matching.replaceRequirements(useCase, "hash-2",
				List.of(new Requirement(1, "capability", "required", "Answers calls at night.", "calls at night")));

		assertThat(matching.requirementsSource(useCase)).contains("hash-2");
		assertThat(matching.requirements(useCase))
			.containsExactly(new Requirement(1, "capability", "required", "Answers calls at night.", "calls at night"));
	}

	@Test
	void aLaterRunReplacesTheCandidatesItNoLongerFindsAndKeepsThoseAPersonDecidedOn() {
		UUID useCase = UUID.randomUUID();
		UUID kept = UUID.randomUUID();
		UUID decided = UUID.randomUUID();
		UUID dropped = UUID.randomUUID();
		UUID found = UUID.randomUUID();
		UUID run = matching.queue(useCase, MatchingRepository.BY_APPROVAL, null, 1).orElseThrow();

		matching.found(useCase, List.of(kept, decided, dropped));
		matching.judged(useCase, kept, run,
				new Judged("direct", 2, 2, Map.of("requirements", List.of(Map.of("requirement", 1, "status", "met"))),
						"It answers calls.", List.of("website"), "fingerprint-1"));
		matching.judged(useCase, dropped, run, new Judged("none", 0, 2, Map.of(), null, List.of(), "fingerprint-2"));
		jdbc.sql("""
				insert into matching_decision (candidate_id, kind, account_id)
				select id, 'shortlisted', gen_random_uuid() from matching_candidate where solution_id = ?
				""").param(decided).update();
		assertThat(matching.fingerprints(useCase))
			.containsOnly(Map.entry(kept, "fingerprint-1"), Map.entry(dropped, "fingerprint-2"));

		matching.found(useCase, List.of(found, kept));

		assertThat(jdbc.sql("""
				select solution_id || ' ' || coalesce(found_at::text, '-') || ' ' || bucket
				from matching_candidate where use_case_id = ? order by found_at nulls last
				""").param(useCase).query(String.class).list())
			.containsExactly(found + " 1 none", kept + " 2 direct", decided + " - none");
		assertThat(jdbc.sql("""
				select summary || ' ' || array_to_string(unread, ',') || ' ' || (findings -> 'requirements' -> 0 ->> 'status')
				from matching_candidate where solution_id = ?
				""").param(kept).query(String.class).single()).isEqualTo("It answers calls. website met");
	}

	private List<String> states() {
		return jdbc.sql("select state from matching_run").query(String.class).list();
	}

}
