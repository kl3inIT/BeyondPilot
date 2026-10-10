package ai.genaifund.beyondpilot.matching;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import ai.genaifund.beyondpilot.matching.persistence.MatchingFeedbackRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingFeedbackRepository.Answer;
import ai.genaifund.beyondpilot.matching.persistence.MatchingFeedbackRepository.Disagreement;
import ai.genaifund.beyondpilot.matching.persistence.MatchingFeedbackRepository.Totals;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Candidate;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Judged;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Requirement;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Run;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Settings;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Step;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.groups.Tuple.tuple;

/**
 * What matching keeps, against PostgreSQL: one open run per use case, taken by the worker in the order they were
 * queued, candidates that a later run replaces without touching what people decided, and what people said about the
 * group of a judgment.
 */
// The worker would take the runs this test queues; here it never wakes.
@SpringBootTest(properties = "beyondpilot.matching.interval=PT24H")
@Import(TestcontainersConfiguration.class)
class MatchingRepositoryTest {

	@Autowired
	private MatchingRepository matching;

	@Autowired
	private MatchingFeedbackRepository feedback;

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
		assertThat(matching.hasFinishedRun(first)).isFalse();

		UUID run = matching.queue(first, MatchingRepository.BY_APPROVAL, null, 1, null, false).orElseThrow();
		// A second start while one is open is refused, whoever asks.
		assertThat(matching.queue(first, MatchingRepository.BY_OPERATOR, UUID.randomUUID(), 1, null, false)).isEmpty();
		jdbc.sql("update matching_run set created_at = now() - interval '1 minute' where id = ?").param(run).update();
		UUID later = matching.queue(second, MatchingRepository.BY_OPERATOR, UUID.randomUUID(), 1, null, false).orElseThrow();
		assertThat(matching.hasFinishedRun(first)).isFalse();

		Run taken = matching.claim(null).orElseThrow();
		assertThat(taken).isEqualTo(new Run(run, first, 0, false));
		assertThat(matching.claim(null).map(Run::id)).contains(later);
		assertThat(matching.claim(null)).isEmpty();

		// A run that waits is taken again only when its time has come, and remembers how often it stalled.
		matching.waitUntil(run, Instant.now().plusSeconds(600), 2, "java.lang.IllegalStateException");
		assertThat(matching.claim(null)).isEmpty();
		assertThat(matching.queue(first, MatchingRepository.BY_OPERATOR, null, 1, null, false)).isEmpty();
		matching.waitUntil(run, Instant.now().minusSeconds(1), 2, "java.lang.IllegalStateException");
		assertThat(matching.claim(null)).contains(new Run(run, first, 2, false));

		// What a stopped application left running is queued again.
		assertThat(matching.requeueInterrupted()).isEqualTo(2);
		assertThat(matching.claim(null).map(Run::id)).contains(run);
		matching.finish(run);
		matching.fail(later, MatchingRuns.NO_MODEL);
		assertThat(states()).containsExactlyInAnyOrder("done", "failed");
		// Only a run that judged everything counts as finished; a failed one leaves the use case to be matched.
		assertThat(matching.hasFinishedRun(first)).isTrue();
		assertThat(matching.hasFinishedRun(second)).isFalse();
		// Once its run has ended, a use case can have another.
		assertThat(matching.queue(first, MatchingRepository.BY_OPERATOR, null, 1, null, false)).isPresent();
	}

	@Test
	void aRunWaitsForItsMomentAndForTheDaysLimitAndAPersonCanStartItAtOnce() {
		UUID useCase = UUID.randomUUID();
		UUID other = UUID.randomUUID();
		UUID run = matching.queue(useCase, MatchingRepository.BY_APPROVAL, null, 1, Instant.now().plusSeconds(600), false)
			.orElseThrow();

		// The use case changed: its run is not taken before it has stayed unchanged long enough.
		assertThat(matching.claim(null)).isEmpty();
		assertThat(matching.postpone(useCase, Instant.now().plusSeconds(1200))).isTrue();
		assertThat(matching.postpone(other, Instant.now())).isFalse();
		assertThat(matching.queuedToday(useCase, MatchingRepository.BY_APPROVAL)).isEqualTo(1);
		assertThat(matching.queuedToday(useCase, MatchingRepository.BY_MEMBER)).isZero();

		// A person asks for a run: the one that waited starts now, and it is still one run.
		assertThat(matching.startNow(useCase)).isTrue();
		assertThat(matching.startNow(useCase)).as("it no longer waits for a moment").isFalse();
		assertThat(matching.startNow(other)).isFalse();
		assertThat(matching.claim(1)).contains(new Run(run, useCase, 0, false));

		// One run a day in all: the next waits queued, and is taken once the limit allows it.
		UUID second = matching.queue(other, MatchingRepository.BY_MEMBER, UUID.randomUUID(), 1, null, true).orElseThrow();
		assertThat(matching.claim(1)).isEmpty();
		assertThat(matching.claim(2)).contains(new Run(second, other, 0, true));
		// A run that started and waits for the provider goes on whatever the limit: it was counted when it started.
		matching.waitUntil(run, Instant.now().minusSeconds(1), 1, "java.lang.IllegalStateException");
		assertThat(matching.claim(1).map(Run::id)).contains(run);
		assertThat(matching.lastRun(other).orElseThrow().origin()).isEqualTo(MatchingRepository.BY_MEMBER);
	}

	@Test
	void theLimitsAreKeptOnlyWhenNobodyChangedThemMeanwhile() {
		jdbc.sql("""
				update matching_settings set settle_minutes = 10, edit_runs_per_day = 3, member_runs_per_day = 3,
				    runs_per_day = 200, candidates = 40, parallel = 8, version = 0
				""").update();
		assertThat(matching.settings()).isEqualTo(new Settings(10, 3, 3, 200, 40, 8, 0));

		assertThat(matching.saveSettings(new Settings(0, 1, 2, null, 20, 16, 0))).isTrue();
		assertThat(matching.settings()).isEqualTo(new Settings(0, 1, 2, null, 20, 16, 1));
		assertThat(matching.saveSettings(new Settings(5, 5, 5, 5, 50, 1, 0))).as("read before the last change").isFalse();
		assertThat(matching.settings()).as("a refused change keeps nothing").isEqualTo(new Settings(0, 1, 2, null, 20, 16, 1));
		assertThat(matching.saveSettings(new Settings(10, 3, 3, 200, 40, 8, 1))).isTrue();
	}

	@Test
	void aCandidateIsWhatPeopleLastDecidedAndAnOperatorsHandIsKeptApart() {
		UUID useCase = UUID.randomUUID();
		UUID found = UUID.randomUUID();
		UUID byHand = UUID.randomUUID();
		UUID person = UUID.randomUUID();
		matching.found(useCase, List.of(found));
		UUID added = matching.add(useCase, byHand, person).orElseThrow();
		assertThat(matching.add(useCase, byHand, person)).as("a candidate already").isEmpty();
		assertThat(matching.add(useCase, found, person)).as("found by a run").isEmpty();
		assertThat(matching.addedSolutions(useCase)).containsExactly(byHand);

		assertThat(matching.candidates(useCase)).extracting(Candidate::solutionId, Candidate::origin,
				Candidate::decision, Candidate::judged)
			.containsExactly(org.assertj.core.groups.Tuple.tuple(found, "recommended", "none", false),
					org.assertj.core.groups.Tuple.tuple(byHand, "added", "none", false));

		matching.decide(added, MatchingRepository.SHORTLISTED, null, null, person, false);
		assertThat(matching.candidate(added).orElseThrow().decision()).isEqualTo("shortlisted");
		jdbc.sql("update matching_decision set created_at = now() - interval '2 minutes'").update();
		matching.decide(added, MatchingRepository.REMOVED, "other", "Met them last year.", person, true);
		Candidate removed = matching.candidate(added).orElseThrow();
		assertThat(removed.decision()).isEqualTo("removed");
		assertThat(removed.reason()).isEqualTo("other");
		assertThat(removed.note()).isEqualTo("Met them last year.");
		assertThat(removed.decidedByOperator()).isTrue();
		assertThat(removed.decidedBy()).isEqualTo(person);
		assertThat(removed.decidedAt()).isNotNull();
		jdbc.sql("update matching_decision set created_at = created_at - interval '2 minutes'").update();
		matching.decide(added, MatchingRepository.RESTORED, null, null, person, false);
		assertThat(matching.candidate(added).orElseThrow()).extracting(Candidate::decision, Candidate::reason)
			.containsExactly("none", null);
		assertThat(matching.candidate(UUID.randomUUID())).isEmpty();
	}

	@Test
	void aStepAddsWhatEachPassJudgedAndKeepsWhatTheLastPassOfTheOthersGave() {
		UUID run = matching.queue(UUID.randomUUID(), MatchingRepository.BY_APPROVAL, null, 1, null, false).orElseThrow();
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
				List.of(new Requirement(1, "capability", "required", "Answers calls.", "answer calls", ""),
						new Requirement(2, "constraint", "optional", "Runs on premises.", "our data centre", "")));
		matching.replaceRequirements(useCase, "hash-2",
				List.of(new Requirement(1, "capability", "required", "Answers calls at night.", "calls at night",
						"Answer calls")));

		assertThat(matching.requirementsSource(useCase)).contains("hash-2");
		assertThat(matching.requirements(useCase))
			.containsExactly(new Requirement(1, "capability", "required", "Answers calls at night.", "calls at night",
					"Answer calls"));
	}

	@Test
	void aLaterRunReplacesTheCandidatesItNoLongerFindsAndKeepsThoseAPersonDecidedOn() {
		UUID useCase = UUID.randomUUID();
		UUID kept = UUID.randomUUID();
		UUID decided = UUID.randomUUID();
		UUID dropped = UUID.randomUUID();
		UUID found = UUID.randomUUID();
		UUID run = matching.queue(useCase, MatchingRepository.BY_APPROVAL, null, 1, null, false).orElseThrow();

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

	@Test
	void aPersonsLastAnswerAboutAJudgmentCountsAndAnAnswerAboutAnEarlierJudgmentIsNotTheCurrentOne() {
		UUID useCase = UUID.randomUUID();
		UUID solution = UUID.randomUUID();
		UUID person = UUID.randomUUID();
		UUID colleague = UUID.randomUUID();
		UUID run = matching.queue(useCase, MatchingRepository.BY_APPROVAL, null, 1, null, false).orElseThrow();
		matching.found(useCase, List.of(solution));
		matching.judged(useCase, solution, run, new Judged("industry", 0, 1, Map.of(), null, List.of(), "fingerprint-1"));
		Candidate judged = matching.candidates(useCase).getFirst();
		UUID candidate = judged.id();
		assertThat(judged.fingerprint()).isEqualTo("fingerprint-1");
		assertThat(feedback.current(useCase)).isEmpty();
		assertThat(feedback.totals(Instant.now().minusSeconds(3600))).isEqualTo(new Totals(0, 0));

		// The person agrees, then changes their mind: answers are only added, and the last one is theirs.
		feedback.answer(candidate, person, "fingerprint-1", "industry", true, null, List.of(), null);
		jdbc.sql("update matching_feedback set created_at = created_at - interval '2 minutes'").update();
		feedback.answer(candidate, person, "fingerprint-1", "industry", false, "direct", List.of(1, 3),
				"They do this for two banks.");
		feedback.answer(candidate, colleague, "fingerprint-1", "industry", true, null, List.of(), null);
		assertThat(jdbc.sql("select count(*) from matching_feedback").query(Long.class).single()).isEqualTo(3);
		assertThat(feedback.current(useCase))
			.extracting(Answer::candidateId, Answer::accountId, Answer::agrees, Answer::expectedBucket,
					Answer::requirements, Answer::note)
			.containsExactlyInAnyOrder(
					tuple(candidate, person, false, "direct", List.of(1, 3), "They do this for two banks."),
					tuple(candidate, colleague, true, null, List.of(), null));
		// Each person counts once, by their last answer; an answer given before the period is not counted.
		assertThat(feedback.totals(Instant.now().minusSeconds(3600))).isEqualTo(new Totals(2, 1));
		assertThat(feedback.totals(Instant.now().plusSeconds(60))).isEqualTo(new Totals(0, 0));
		assertThat(feedback.disagreementCount()).isEqualTo(1);
		assertThat(feedback.disagreements(20, 0))
			.extracting(Disagreement::candidateId, Disagreement::useCaseId, Disagreement::solutionId,
					Disagreement::aiBucket, Disagreement::expectedBucket, Disagreement::requirements,
					Disagreement::accountId, Disagreement::current)
			.containsExactly(tuple(candidate, useCase, solution, "industry", "direct", List.of(1, 3), person, true));
		assertThat(feedback.disagreements(20, 20)).as("a page past the end").isEmpty();

		// The solution is judged again from other material: the question is open again, and the earlier answers stay.
		matching.judged(useCase, solution, run, new Judged("industry", 0, 1, Map.of(), null, List.of(), "fingerprint-2"));
		assertThat(feedback.current(useCase)).isEmpty();
		assertThat(feedback.disagreements(20, 0)).extracting(Disagreement::accountId, Disagreement::current)
			.containsExactly(tuple(person, false));
		feedback.answer(candidate, person, "fingerprint-2", "industry", true, null, List.of(), null);
		assertThat(feedback.current(useCase)).extracting(Answer::accountId, Answer::agrees)
			.containsExactly(tuple(person, true));
		assertThat(feedback.totals(Instant.now().minusSeconds(3600))).isEqualTo(new Totals(3, 2));
		// The same material judged into another group is another judgment too.
		matching.judged(useCase, solution, run, new Judged("direct", 1, 1, Map.of(), null, List.of(), "fingerprint-2"));
		assertThat(feedback.current(useCase)).isEmpty();

		// The database refuses an answer that disagrees and expects the group the AI gave, or agrees and expects one.
		assertThatThrownBy(
				() -> feedback.answer(candidate, person, "fingerprint-2", "direct", false, "direct", List.of(), null))
			.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(
				() -> feedback.answer(candidate, person, "fingerprint-2", "direct", true, "industry", List.of(), null))
			.isInstanceOf(DataIntegrityViolationException.class);
		// The answers of a candidate go with it.
		jdbc.sql("delete from matching_candidate where id = ?").param(candidate).update();
		assertThat(jdbc.sql("select count(*) from matching_feedback").query(Long.class).single()).isZero();
	}

	private List<String> states() {
		return jdbc.sql("select state from matching_run").query(String.class).list();
	}

}
