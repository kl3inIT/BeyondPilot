package ai.genaifund.beyondpilot.matching;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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
import ai.genaifund.beyondpilot.ai.ProviderFailures;
import ai.genaifund.beyondpilot.matching.dto.MatchingChange.Kind;
import ai.genaifund.beyondpilot.matching.persistence.MatchingProposalRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingProposalRepository.Evaluation;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRunHistory;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Judged;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Requirement;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Run;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Settings;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Step;
import ai.genaifund.beyondpilot.proposal.SentUseCaseProposal;
import ai.genaifund.beyondpilot.proposal.UseCaseProposals;
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
 * the run waits and goes on; a run that keeps stopping without judging anything ends as failed. Each thing a run
 * does is told to the pages open on its use case once it is stored ({@link MatchingChanges}). After the candidates, a
 * run judges the proposals the use case received against the same requirements (BEY-229); a proposal sent or edited
 * queues a run.
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

	/**
	 * The provider refused the request itself: what was sent, the key or the model. Asked again it is refused again,
	 * so the run ends at once and an operator looks at the model chosen for matching.
	 */
	static final String REQUEST_REFUSED = "request_refused";

	/** What the calls of a run are recorded about, with the run's id, so its cost can be read back. */
	static final String SUBJECT = "matching_run";

	/** How many more solutions are asked of the search, to make up for the organization's own. */
	private static final int OWN_SOLUTIONS = 10;

	private final MatchingRepository matching;

	private final Requirements requirements;

	private final UseCaseDirectory useCases;

	private final SolutionDirectory solutions;

	private final SolutionEvidence evidence;

	private final AiModels models;

	private final MatchingSettings settings;

	private final TransactionTemplate transactions;

	private final MatchingChanges changes;

	private final MatchingRunHistory history;

	private final UseCaseProposals proposals;

	private final ProposalSources proposalSources;

	private final MatchingProposalRepository evaluations;

	/** Whether the runs a stopped application left running were queued again. */
	private volatile boolean recovered;

	/** Whether a run is being worked on; the worker takes one at a time. */
	private final AtomicBoolean working = new AtomicBoolean();

	MatchingRuns(MatchingRepository matching, Requirements requirements, UseCaseDirectory useCases,
			SolutionDirectory solutions, SolutionEvidence evidence, AiModels models, MatchingSettings settings,
			TransactionTemplate transactions, MatchingChanges changes, MatchingRunHistory history,
			UseCaseProposals proposals, ProposalSources proposalSources, MatchingProposalRepository evaluations) {
		this.matching = matching;
		this.requirements = requirements;
		this.useCases = useCases;
		this.solutions = solutions;
		this.evidence = evidence;
		this.models = models;
		this.settings = settings;
		this.transactions = transactions;
		this.changes = changes;
		this.history = history;
		this.proposals = proposals;
		this.proposalSources = proposalSources;
		this.evaluations = evaluations;
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
		Settings limits = matching.settings();
		// The run waits until the use case has stayed unchanged for a while: people save a brief several times.
		Instant notBefore = limits.settleMinutes() == 0 ? null
				: Instant.now().plus(Duration.ofMinutes(limits.settleMinutes()));
		if (notBefore != null && matching.postpone(useCaseId, MatchingRepository.BY_APPROVAL, notBefore)) {
			changes.tell(useCaseId, Kind.RUN);
			return;
		}
		if (matching.queuedToday(useCaseId, MatchingRepository.BY_APPROVAL) >= limits.editRunsPerDay()) {
			LOG.atInfo()
				.addKeyValue("event", "matching.run.not_queued")
				.addKeyValue("useCaseId", useCaseId)
				.log("A use case changed again; its changes started as many runs as a day allows");
			return;
		}
		matching.queue(useCaseId, MatchingRepository.BY_APPROVAL, null, Prompts.VERSION, notBefore, false)
			.ifPresent(runId -> {
				changes.tell(useCaseId, Kind.RUN);
				LOG.atInfo()
					.addKeyValue("event", "matching.run.queued")
					.addKeyValue("runId", runId)
					.addKeyValue("useCaseId", useCaseId)
					.log("A run of matching was queued for a use case");
			});
	}

	/**
	 * A proposal to the use case was sent or edited: a run is queued to judge it, once the proposals have stayed
	 * unchanged for the settle minutes, as after an edit of the brief. A run that has not ended reads the proposals
	 * when it reaches them, and one that read them before the change queues the next when it ends.
	 */
	void proposalSent(UUID useCaseId) {
		if (useCases.brief(useCaseId).isEmpty() || !models.available(AiTask.MATCHING)) {
			return;
		}
		Settings limits = matching.settings();
		Instant notBefore = limits.settleMinutes() == 0 ? null
				: Instant.now().plus(Duration.ofMinutes(limits.settleMinutes()));
		if (notBefore != null && matching.postpone(useCaseId, MatchingRepository.BY_PROPOSAL, notBefore)) {
			changes.tell(useCaseId, Kind.RUN);
			return;
		}
		matching.queue(useCaseId, MatchingRepository.BY_PROPOSAL, null, Prompts.VERSION, notBefore, false)
			.ifPresent(runId -> {
				changes.tell(useCaseId, Kind.RUN);
				LOG.atInfo()
					.addKeyValue("event", "matching.run.queued")
					.addKeyValue("runId", runId)
					.addKeyValue("useCaseId", useCaseId)
					.log("A run of matching was queued for a proposal to a use case");
			});
	}

	/** Whether a proposal the use case holds now was sent or edited after the evaluation kept for it, or has none. */
	private boolean proposalsWaiting(UUID useCaseId) {
		Map<UUID, Evaluation> kept = evaluations.of(useCaseId);
		return proposals.sentTo(useCaseId).stream().anyMatch(proposal -> {
			Evaluation evaluation = kept.get(proposal.id());
			return evaluation == null || !evaluation.stamp().equals(proposal.stamp());
		});
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
		Run run = matching.claim(matching.settings().runsPerDay()).orElse(null);
		if (run == null) {
			return;
		}
		try {
			work(run);
		}
		catch (RuntimeException | LinkageError failure) {
			stop(run, 0, kind(failure));
		}
	}

	private void work(Run run) {
		// The limits are read once, as the run starts: a change made while it works applies to the next run.
		Settings limits = matching.settings();
		changes.tell(run.useCaseId(), Kind.RUN);
		UseCaseBrief brief = useCases.brief(run.useCaseId()).orElse(null);
		if (brief == null) {
			fail(run, NO_USE_CASE);
			return;
		}
		if (!models.available(AiTask.MATCHING)) {
			fail(run, NO_MODEL);
			return;
		}
		Requirements.Read read = requirements.of(brief, run.id());
		changes.tell(run.useCaseId(), Kind.BRIEF);
		List<String> queries = new ArrayList<>(List.of(brief.title()));
		read.requirements().stream().filter(Requirement::isCapability).map(Requirement::statement).forEach(queries::add);
		if (queries.size() == 1) {
			fail(run, NO_CAPABILITY);
			return;
		}
		long searching = System.nanoTime();
		int wanted = limits.candidates();
		Map<UUID, IndexedSolution> shown = new LinkedHashMap<>();
		List<UUID> found = new ArrayList<>();
		for (UUID solutionId : evidence.solutionsFor(queries, wanted + OWN_SOLUTIONS)) {
			IndexedSolution solution = solutions.indexed(solutionId).orElse(null);
			// An organization is never recommended its own solutions.
			if (solution != null && !solution.organizationId().equals(brief.organizationId()) && found.size() < wanted) {
				shown.put(solutionId, solution);
				found.add(solutionId);
			}
		}
		transactions.executeWithoutResult(status -> matching.found(run.useCaseId(), found));
		matching.addToStep(run.id(), new Step(MatchingRepository.CANDIDATES, queries.size(), found.size(), 0, 0, 0,
				(System.nanoTime() - searching) / 1_000_000));
		changes.tell(run.useCaseId(), Kind.FOUND);
		// What an operator added by hand is judged with what the run found.
		List<UUID> candidates = new ArrayList<>(found);
		for (UUID solutionId : matching.addedSolutions(run.useCaseId())) {
			IndexedSolution solution = shown.containsKey(solutionId) ? null : solutions.indexed(solutionId).orElse(null);
			if (solution != null) {
				shown.put(solutionId, solution);
				candidates.add(solutionId);
			}
		}

		Map<UUID, String> judgedBefore = run.judgeAll() ? Map.of() : matching.fingerprints(run.useCaseId());
		// The proposals the use case holds now, with what each says but its PDF, which is read only to be judged.
		List<ProposalSources.Material> offers = proposals.sentTo(run.useCaseId())
			.stream()
			.map(proposalSources::material)
			.toList();
		Map<UUID, Evaluation> evaluatedBefore = run.judgeAll() ? Map.of() : evaluations.of(run.useCaseId());
		AtomicInteger proposalsJudged = new AtomicInteger();
		AtomicInteger proposalCalls = new AtomicInteger();
		AtomicLong proposalInput = new AtomicLong();
		AtomicLong proposalOutput = new AtomicLong();
		AtomicInteger judged = new AtomicInteger();
		AtomicInteger calls = new AtomicInteger();
		AtomicLong input = new AtomicLong();
		AtomicLong output = new AtomicLong();
		AtomicReference<@Nullable String> refusal = new AtomicReference<>();
		long judging = System.nanoTime();
		Semaphore room = new Semaphore(limits.parallel());
		// The same instructions for every candidate of the run, first in each call, so the provider caches them.
		String instructions = Prompts.judging(brief, read.requirements());
		try (AiChat chat = models.chat(AiTask.MATCHING, new AiSubject(SUBJECT, run.id().toString()));
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
						IndexedSolution solution = shown.get(solutionId);
						Sources sources = Sources.of(solution, evidence.passagesOf(solutionId));
						String fingerprint = Quotes.fingerprint(Integer.toString(Prompts.VERSION), read.sourceHash(),
								sources.fingerprint());
						if (fingerprint.equals(judgedBefore.get(solutionId))) {
							history.record(run.id(), run.useCaseId(), solutionId, false);
							changes.tell(run.useCaseId(), Kind.READ, solutionId);
							return;
						}
						changes.tell(run.useCaseId(), Kind.READING, solutionId);
						Asking.Answer<Judgment> answer = Asking.ask(chat, instructions,
								Prompts.candidate(sources.texts()), Judgment.class);
						calls.addAndGet(answer.calls());
						input.addAndGet(answer.inputTokens());
						output.addAndGet(answer.outputTokens());
						Judged settled = Buckets.settle(answer.value(), read.requirements(), sources, fingerprint);
						matching.judged(run.useCaseId(), solutionId, run.id(), settled);
						history.record(run.id(), run.useCaseId(), solutionId, true);
						judged.incrementAndGet();
						changes.tell(run.useCaseId(), Kind.READ, solutionId);
					}
					catch (RuntimeException | LinkageError failure) {
						refusal.compareAndSet(null, kind(failure));
						// The page stops showing it as being read; the run says why it stopped when it ends.
						changes.tell(run.useCaseId(), Kind.READ, solutionId);
					}
					finally {
						room.release();
					}
				});
			}
			for (ProposalSources.Material offer : offers) {
				workers.submit(() -> {
					room.acquireUninterruptibly();
					try {
						if (refusal.get() == null) {
							judge(run, offer, read, instructions, chat, evaluatedBefore, proposalsJudged, proposalCalls,
									proposalInput, proposalOutput);
						}
					}
					catch (RuntimeException | LinkageError failure) {
						refusal.compareAndSet(null, kind(failure));
					}
					finally {
						room.release();
					}
				});
			}
		}
		long tookMillis = (System.nanoTime() - judging) / 1_000_000;
		matching.addToStep(run.id(), new Step(MatchingRepository.JUDGMENT, candidates.size(), judged.get(), calls.get(),
				input.get(), output.get(), tookMillis));
		if (!offers.isEmpty()) {
			matching.addToStep(run.id(), new Step(MatchingRepository.PROPOSALS, offers.size(), proposalsJudged.get(),
					proposalCalls.get(), proposalInput.get(), proposalOutput.get(), tookMillis));
		}
		String refused = refusal.get();
		if (refused == null) {
			matching.finish(run.id());
			changes.tell(run.useCaseId(), Kind.RUN);
			// A brief that changed while the run worked asks for another, and so does a proposal sent or edited after
			// the run read the proposals.
			changed(run.useCaseId());
			if (proposalsWaiting(run.useCaseId())) {
				proposalSent(run.useCaseId());
			}
			LOG.atInfo()
				.addKeyValue("event", "matching.run.done")
				.addKeyValue("runId", run.id())
				.addKeyValue("candidates", candidates.size())
				.addKeyValue("judged", judged.get())
				.addKeyValue("proposals", proposalsJudged.get())
				.log("A run of matching ended");
		}
		else {
			stop(run, judged.get() + proposalsJudged.get(), refused);
		}
	}

	/**
	 * Judges one proposal against the requirements the run read, unless it was judged from the same material against
	 * the same requirements: then its evaluation stands for what it says now. Its PDF is read only here.
	 */
	private void judge(Run run, ProposalSources.Material offer, Requirements.Read read, String instructions,
			AiChat chat, Map<UUID, Evaluation> before, AtomicInteger judged, AtomicInteger calls, AtomicLong input,
			AtomicLong output) {
		SentUseCaseProposal proposal = offer.proposal();
		String fingerprint = Quotes.fingerprint(Integer.toString(Prompts.PROPOSAL_VERSION),
				Integer.toString(Prompts.VERSION), read.sourceHash(), offer.fingerprint());
		Evaluation kept = before.get(proposal.id());
		if (kept != null && fingerprint.equals(kept.fingerprint())) {
			if (!kept.stamp().equals(proposal.stamp())) {
				evaluations.unchanged(proposal.id(), proposal.stamp());
			}
			return;
		}
		Sources sources = proposalSources.read(offer, run.id());
		Asking.Answer<Judgment> answer = Asking.ask(chat, instructions, Prompts.proposal(sources.texts()),
				Judgment.class);
		calls.addAndGet(answer.calls());
		input.addAndGet(answer.inputTokens());
		output.addAndGet(answer.outputTokens());
		Judged settled = Buckets.settle(answer.value(), read.requirements(), sources, fingerprint);
		evaluations.judged(proposal.id(), run.useCaseId(), proposal.stamp(), run.id(), settled);
		judged.incrementAndGet();
	}

	/** The kind of a failed call, as a run keeps it: never a provider's message. */
	private static String kind(Throwable failure) {
		return ProviderFailures.refused(failure) ? REQUEST_REFUSED : failure.getClass().getName();
	}

	/** A run ends without finishing, for one of matching's own reasons. */
	private void fail(Run run, String reason) {
		matching.fail(run.id(), reason);
		changes.tell(run.useCaseId(), Kind.RUN);
	}

	/**
	 * A run could not go on now. It waits and continues, unless it has stopped too many times in a row without judging
	 * anything; then it ends as failed and can be started again from where it stopped.
	 * @param judged how many candidates this pass judged
	 * @param failure the kind of failure, never a provider's message
	 */
	private void stop(Run run, int judged, String failure) {
		int stalls = judged > 0 ? 0 : run.stalls() + 1;
		boolean ends = REQUEST_REFUSED.equals(failure) || stalls > settings.maxStalls();
		if (ends) {
			matching.fail(run.id(), failure);
		}
		else {
			matching.waitUntil(run.id(), Instant.now().plus(settings.pause()), stalls, failure);
		}
		changes.tell(run.useCaseId(), Kind.RUN);
		LOG.atWarn()
			.addKeyValue("event", ends ? "matching.run.failed" : "matching.run.waiting")
			.addKeyValue("runId", run.id())
			.addKeyValue("error_type", failure)
			.addKeyValue("judged", judged)
			.log("A run of matching stopped before it had judged every candidate");
	}

}
