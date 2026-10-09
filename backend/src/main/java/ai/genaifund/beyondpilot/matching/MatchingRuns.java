package ai.genaifund.beyondpilot.matching;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import ai.genaifund.beyondpilot.ai.AiChat;
import ai.genaifund.beyondpilot.ai.AiModels;
import ai.genaifund.beyondpilot.ai.AiSubject;
import ai.genaifund.beyondpilot.ai.AiTask;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Judged;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Requirement;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Run;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Step;
import ai.genaifund.beyondpilot.search.SolutionEvidence;
import ai.genaifund.beyondpilot.solution.IndexedSolution;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import ai.genaifund.beyondpilot.usecase.UseCaseBrief;
import ai.genaifund.beyondpilot.usecase.UseCaseDirectory;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The runs of matching. A run is queued and a worker takes it: it reads the use case's requirements, finds the
 * candidates, and has the model judge each one, a few at a time. A run is not a transaction: each judged candidate is
 * kept when its judgment ends, so a run that stops continues with those not judged yet. When the provider refuses,
 * the run waits and goes on; a run that keeps stopping without judging anything ends as failed.
 */
@Service
@EnableConfigurationProperties(MatchingSettings.class)
class MatchingRuns {

	private static final Logger LOG = LoggerFactory.getLogger(MatchingRuns.class);

	/** The use case is not published any more. */
	static final String NO_USE_CASE = "use_case_not_published";

	/** No model is chosen for matching, or its provider is switched off. */
	static final String NO_MODEL = "no_model";

	/** The brief gave no capability a product could be judged on. */
	static final String NO_CAPABILITY = "no_capability";

	private final MatchingRepository matching;

	private final Requirements requirements;

	private final UseCaseDirectory useCases;

	private final SolutionDirectory solutions;

	private final SolutionEvidence evidence;

	private final AiModels models;

	private final MatchingSettings settings;

	private final TransactionTemplate transactions;

	/** Whether the runs a stopped application left running were queued again. */
	private volatile boolean recovered;

	/** Whether a run is being worked on; the worker takes one at a time. */
	private final AtomicBoolean working = new AtomicBoolean();

	MatchingRuns(MatchingRepository matching, Requirements requirements, UseCaseDirectory useCases,
			SolutionDirectory solutions, SolutionEvidence evidence, AiModels models, MatchingSettings settings,
			TransactionTemplate transactions) {
		this.matching = matching;
		this.requirements = requirements;
		this.useCases = useCases;
		this.solutions = solutions;
		this.evidence = evidence;
		this.models = models;
		this.settings = settings;
		this.transactions = transactions;
	}

	/**
	 * A use case changed: a run is queued when it is published, a model is chosen, and its brief is not the one a
	 * finished run read. A change that leaves the brief as it was queues nothing, unless its last run failed.
	 */
	void changed(UUID useCaseId) {
		UseCaseBrief brief = useCases.brief(useCaseId).orElse(null);
		if (brief == null || !models.available(AiTask.MATCHING)) {
			return;
		}
		boolean read = Requirements.fingerprint(brief).equals(matching.requirementsSource(useCaseId).orElse(null));
		if (read && matching.hasFinishedRun(useCaseId)) {
			return;
		}
		matching.queue(useCaseId, MatchingRepository.BY_APPROVAL, null, Prompts.VERSION)
			.ifPresent(runId -> LOG.atInfo()
				.addKeyValue("event", "matching.run.queued")
				.addKeyValue("runId", runId)
				.addKeyValue("useCaseId", useCaseId)
				.log("A run of matching was queued for a use case"));
	}

	/**
	 * Wakes the worker, unless it is at work. The work is done on a thread of its own: scheduled work shares one
	 * thread, a run takes minutes, and the mail, the index and the decks must not wait for it.
	 */
	@Scheduled(fixedDelayString = "${beyondpilot.matching.interval}",
			initialDelayString = "${beyondpilot.matching.interval}")
	void wake() {
		if (working.compareAndSet(false, true)) {
			Thread.ofVirtual().name("matching-run").start(() -> {
				try {
					work();
				}
				catch (RuntimeException | LinkageError failure) {
					LOG.atError()
						.addKeyValue("event", "matching.worker.failed")
						.addKeyValue("error_type", failure.getClass().getName())
						.log("The worker of matching could not take a run");
				}
				finally {
					working.set(false);
				}
			});
		}
	}

	/** Takes the run that waited longest and works on it until it ends or has to wait. */
	void work() {
		if (!recovered) {
			matching.requeueInterrupted();
			recovered = true;
		}
		Run run = matching.claim().orElse(null);
		if (run == null) {
			return;
		}
		try {
			work(run);
		}
		catch (RuntimeException | LinkageError failure) {
			stop(run, 0, failure.getClass().getName());
		}
	}

	private void work(Run run) {
		UseCaseBrief brief = useCases.brief(run.useCaseId()).orElse(null);
		if (brief == null) {
			matching.fail(run.id(), NO_USE_CASE);
			return;
		}
		if (!models.available(AiTask.MATCHING)) {
			matching.fail(run.id(), NO_MODEL);
			return;
		}
		Requirements.Read read = requirements.of(brief, run.id());
		List<String> queries = new ArrayList<>(List.of(brief.title()));
		read.requirements().stream().filter(Requirement::isCapability).map(Requirement::statement).forEach(queries::add);
		if (queries.size() == 1) {
			matching.fail(run.id(), NO_CAPABILITY);
			return;
		}
		long searching = System.nanoTime();
		List<UUID> candidates = evidence.solutionsFor(queries, settings.candidates());
		transactions.executeWithoutResult(status -> matching.found(run.useCaseId(), candidates));
		matching.addToStep(run.id(), new Step(MatchingRepository.CANDIDATES, queries.size(), candidates.size(), 0, 0, 0,
				(System.nanoTime() - searching) / 1_000_000));

		Map<UUID, String> judgedBefore = matching.fingerprints(run.useCaseId());
		AtomicInteger judged = new AtomicInteger();
		AtomicInteger calls = new AtomicInteger();
		AtomicLong input = new AtomicLong();
		AtomicLong output = new AtomicLong();
		AtomicReference<@Nullable String> refusal = new AtomicReference<>();
		long judging = System.nanoTime();
		Semaphore room = new Semaphore(Math.max(1, settings.parallel()));
		try (AiChat chat = models.chat(AiTask.MATCHING, new AiSubject("matching_run", run.id().toString()));
				ExecutorService workers = Executors.newVirtualThreadPerTaskExecutor()) {
			matching.judgedWith(run.id(), chat.modelName());
			for (UUID solutionId : candidates) {
				workers.submit(() -> {
					room.acquireUninterruptibly();
					try {
						// After a refusal nothing more is asked: the provider's limit is the likely reason.
						if (refusal.get() != null) {
							return;
						}
						IndexedSolution solution = solutions.indexed(solutionId).orElse(null);
						if (solution == null) {
							return;
						}
						Sources sources = Sources.of(solution, evidence.passagesOf(solutionId));
						String fingerprint = Quotes.fingerprint(Integer.toString(Prompts.VERSION), read.sourceHash(),
								sources.fingerprint());
						if (fingerprint.equals(judgedBefore.get(solutionId))) {
							return;
						}
						Asking.Answer<Judgment> answer = Asking.ask(chat, Prompts.JUDGMENT,
								Prompts.candidate(brief, read.requirements(), sources.texts()), Judgment.class);
						calls.addAndGet(answer.calls());
						input.addAndGet(answer.inputTokens());
						output.addAndGet(answer.outputTokens());
						Judged settled = Buckets.settle(answer.value(), read.requirements(), sources, fingerprint);
						matching.judged(run.useCaseId(), solutionId, run.id(), settled);
						judged.incrementAndGet();
					}
					catch (RuntimeException | LinkageError failure) {
						refusal.compareAndSet(null, failure.getClass().getName());
					}
					finally {
						room.release();
					}
				});
			}
		}
		matching.addToStep(run.id(), new Step(MatchingRepository.JUDGMENT, candidates.size(), judged.get(), calls.get(),
				input.get(), output.get(), (System.nanoTime() - judging) / 1_000_000));
		String refused = refusal.get();
		if (refused == null) {
			matching.finish(run.id());
			LOG.atInfo()
				.addKeyValue("event", "matching.run.done")
				.addKeyValue("runId", run.id())
				.addKeyValue("candidates", candidates.size())
				.addKeyValue("judged", judged.get())
				.log("A run of matching ended");
		}
		else {
			stop(run, judged.get(), refused);
		}
	}

	/**
	 * A run could not go on now. It waits and continues, unless it has stopped too many times in a row without judging
	 * anything; then it ends as failed and can be started again from where it stopped.
	 * @param judged how many candidates this pass judged
	 * @param failure the kind of failure, never a provider's message
	 */
	private void stop(Run run, int judged, String failure) {
		int stalls = judged > 0 ? 0 : run.stalls() + 1;
		if (stalls > settings.maxStalls()) {
			matching.fail(run.id(), failure);
		}
		else {
			matching.waitUntil(run.id(), Instant.now().plus(settings.pause()), stalls, failure);
		}
		LOG.atWarn()
			.addKeyValue("event", stalls > settings.maxStalls() ? "matching.run.failed" : "matching.run.waiting")
			.addKeyValue("runId", run.id())
			.addKeyValue("error_type", failure)
			.addKeyValue("judged", judged)
			.log("A run of matching stopped before it had judged every candidate");
	}

}
