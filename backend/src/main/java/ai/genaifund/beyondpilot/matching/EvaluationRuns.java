package ai.genaifund.beyondpilot.matching;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
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
import ai.genaifund.beyondpilot.matching.EvaluationCandidates.Candidate;
import ai.genaifund.beyondpilot.matching.EvaluationCandidates.Entry;
import ai.genaifund.beyondpilot.matching.EvaluationRules.Assessed;
import ai.genaifund.beyondpilot.matching.persistence.EvaluationRepository;
import ai.genaifund.beyondpilot.matching.persistence.EvaluationRepository.Latest;
import ai.genaifund.beyondpilot.matching.persistence.EvaluationRepository.Run;
import ai.genaifund.beyondpilot.matching.persistence.EvaluationRepository.Step;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.proposal.ReviewService;
import ai.genaifund.beyondpilot.proposal.SentUseCaseProposal;
import ai.genaifund.beyondpilot.proposal.UseCaseProposals;
import ai.genaifund.beyondpilot.usecase.UseCaseBrief;
import ai.genaifund.beyondpilot.usecase.UseCaseDirectory;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * The runs of a program's evaluation (BEY-234). A run is queued and a worker takes it: it gathers the program's
 * candidates, reads the program's approved use cases, and has the model assess each candidate whose material changed
 * since its current assessment, a few at a time. Each assessment is kept when it ends, so a run that stops continues
 * with the candidates not assessed yet. When the provider refuses, the run waits and goes on, as a run of matching
 * does; the limits of matching (settle minutes, runs a day from changes, how many at the same time) apply.
 */
@Service
class EvaluationRuns {

	private static final Logger LOG = LoggerFactory.getLogger(EvaluationRuns.class);

	/** The program has no approved use case to assess against. */
	static final String NO_USE_CASE = "no_use_case";

	/** No model is chosen for evaluation, or its provider is switched off. */
	static final String NO_MODEL = "no_model";

	private final EvaluationRepository evaluations;

	private final MatchingRepository matching;

	private final ReviewService applications;

	private final UseCaseProposals proposals;

	private final UseCaseDirectory useCases;

	private final EvaluationSources sources;

	private final AiModels models;

	private final MatchingSettings settings;

	private volatile boolean recovered;

	private final AtomicBoolean working = new AtomicBoolean();

	EvaluationRuns(EvaluationRepository evaluations, MatchingRepository matching, ReviewService applications,
			UseCaseProposals proposals, UseCaseDirectory useCases, EvaluationSources sources, AiModels models,
			MatchingSettings settings) {
		this.evaluations = evaluations;
		this.matching = matching;
		this.applications = applications;
		this.proposals = proposals;
		this.useCases = useCases;
		this.sources = sources;
		this.models = models;
		this.settings = settings;
	}

	/**
	 * Something a program's evaluation reads changed: a submission, a proposal to one of its use cases, or a use case.
	 * A run is queued once the program has stayed unchanged for the settle minutes, when a model is chosen and the
	 * program has an approved use case. The run itself tells what changed from what was assessed.
	 */
	void changed(UUID programId) {
		if (!models.available(AiTask.EVALUATION) || useCases.approvedIn(programId).isEmpty()) {
			return;
		}
		MatchingRepository.Settings limits = matching.settings();
		Instant notBefore = limits.settleMinutes() == 0 ? null
				: Instant.now().plus(Duration.ofMinutes(limits.settleMinutes()));
		if (notBefore != null && evaluations.postpone(programId, notBefore)) {
			return;
		}
		if (evaluations.queuedToday(programId) >= limits.editRunsPerDay()) {
			LOG.atInfo()
				.addKeyValue("event", "matching.evaluation_run.not_queued")
				.addKeyValue("program_id", programId)
				.log("A program changed again; its changes started as many evaluation runs as a day allows");
			return;
		}
		evaluations.queue(programId, EvaluationRepository.BY_CHANGE, null, EvaluationPrompts.VERSION, notBefore, false)
			.ifPresent(runId -> LOG.atInfo()
				.addKeyValue("event", "matching.evaluation_run.queued")
				.addKeyValue("run_id", runId)
				.addKeyValue("program_id", programId)
				.log("An evaluation run was queued for a program"));
	}

	/** Wakes the worker, unless it is at work, on a thread of its own as matching's worker does. */
	@Scheduled(fixedDelayString = "${beyondpilot.matching.interval}",
			initialDelayString = "${beyondpilot.matching.interval}")
	void wake() {
		if (working.compareAndSet(false, true)) {
			Thread.ofVirtual().name("evaluation-run").start(() -> {
				try {
					work();
				}
				catch (RuntimeException | LinkageError failure) {
					LOG.atError()
						.addKeyValue("event", "matching.evaluation_worker.failed")
						.addKeyValue("error_type", failure.getClass().getName())
						.log("The worker of evaluation could not take a run");
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
			evaluations.requeueInterrupted();
			recovered = true;
		}
		Run run = evaluations.claim().orElse(null);
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
		MatchingRepository.Settings limits = matching.settings();
		List<UseCaseBrief> briefs = briefs(run.programId());
		if (briefs.isEmpty()) {
			evaluations.fail(run.id(), NO_USE_CASE);
			return;
		}
		if (!models.available(AiTask.EVALUATION)) {
			evaluations.fail(run.id(), NO_MODEL);
			return;
		}
		long gathering = System.nanoTime();
		List<Candidate> candidates = candidates(run.programId(), briefs);
		evaluations.gathered(run.id(), candidates.size());
		evaluations.addToStep(run.id(), new Step(EvaluationRepository.CANDIDATES, briefs.size(), candidates.size(), 0,
				0, 0, (System.nanoTime() - gathering) / 1_000_000));
		List<String> briefPrints = briefs.stream().map(Requirements::fingerprint).toList();
		Map<List<UUID>, Latest> before = evaluations.latest(run.programId());
		String instructions = EvaluationPrompts.instructions(briefs);
		AtomicInteger assessed = new AtomicInteger();
		AtomicInteger calls = new AtomicInteger();
		AtomicLong input = new AtomicLong();
		AtomicLong output = new AtomicLong();
		AtomicReference<@Nullable String> refusal = new AtomicReference<>();
		long assessing = System.nanoTime();
		Semaphore room = new Semaphore(limits.parallel());
		try (AiChat chat = models.chat(AiTask.EVALUATION, new AiSubject(EvaluationSources.SUBJECT, run.id().toString()));
				ExecutorService workers = Executors.newVirtualThreadPerTaskExecutor()) {
			evaluations.assessedWith(run.id(), chat.modelName());
			for (Candidate candidate : candidates) {
				workers.submit(() -> {
					room.acquireUninterruptibly();
					try {
						if (refusal.get() != null) {
							return;
						}
						String fingerprint = candidate.fingerprint(EvaluationPrompts.VERSION, briefPrints);
						Latest previous = before.get(List.of(candidate.organizationId(), candidate.solutionId()));
						if (!run.assessAll() && previous != null && fingerprint.equals(previous.fingerprint())) {
							evaluations.counted(run.id());
							return;
						}
						EvaluationSources.Read read = sources.read(candidate, run.id());
						Asking.Answer<EvaluationAnswer> answer = Asking.ask(chat, instructions,
								EvaluationPrompts.candidate(read.texts()), EvaluationAnswer.class,
								EvaluationRules::complete);
						calls.addAndGet(answer.calls());
						input.addAndGet(answer.inputTokens());
						output.addAndGet(answer.outputTokens());
						Assessed kept = EvaluationRules.assessed(answer.value(), read.texts(), read.coverage());
						List<Map<String, Object>> records = records(candidate);
						evaluations.add(new EvaluationRepository.Assessment(run.programId(), candidate.organizationId(),
								candidate.solutionId(), records, fingerprint, kept.tier(), kept.alignment(),
								kept.provisional(), notes(kept), criteria(kept), gate(kept), coverage(read.coverage()),
								changeNote(previous, kept.tier(), records), run.id(), chat.modelName(),
								EvaluationPrompts.VERSION));
						evaluations.counted(run.id());
						assessed.incrementAndGet();
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
		evaluations.addToStep(run.id(), new Step(EvaluationRepository.ASSESSMENT, candidates.size(), assessed.get(),
				calls.get(), input.get(), output.get(), (System.nanoTime() - assessing) / 1_000_000));
		String refused = refusal.get();
		if (refused == null) {
			evaluations.finish(run.id());
			// What changed while the run worked could not queue another run; it does now.
			if (waiting(run.programId())) {
				changed(run.programId());
			}
			LOG.atInfo()
				.addKeyValue("event", "matching.evaluation_run.done")
				.addKeyValue("run_id", run.id())
				.addKeyValue("candidates", candidates.size())
				.addKeyValue("assessed", assessed.get())
				.log("An evaluation run ended");
		}
		else {
			stop(run, assessed.get(), refused);
		}
	}

	/** The candidates of a program as they are now, with the proposals sent to the use cases read. */
	List<Candidate> candidates(UUID programId, List<UseCaseBrief> briefs) {
		List<SentUseCaseProposal> sent = new ArrayList<>();
		briefs.forEach(brief -> sent.addAll(proposals.sentTo(brief.id())));
		return EvaluationCandidates.of(applications.submissionsTo(programId), sent);
	}

	/** Whether a candidate of the program has no assessment of what it holds now. */
	private boolean waiting(UUID programId) {
		List<UseCaseBrief> briefs = briefs(programId);
		List<String> prints = briefs.stream().map(Requirements::fingerprint).toList();
		Map<List<UUID>, Latest> latest = evaluations.latest(programId);
		return candidates(programId, briefs).stream().anyMatch(candidate -> {
			Latest kept = latest.get(List.of(candidate.organizationId(), candidate.solutionId()));
			return kept == null || !kept.fingerprint().equals(candidate.fingerprint(EvaluationPrompts.VERSION, prints));
		});
	}

	/** The program's approved use cases as the model reads them, the oldest published first. */
	List<UseCaseBrief> briefs(UUID programId) {
		return useCases.approvedIn(programId).stream().map(useCases::brief).flatMap(Optional::stream).toList();
	}

	/** The records a candidate combines, as an assessment keeps them. */
	static List<Map<String, Object>> records(Candidate candidate) {
		return candidate.records().stream().map(entry -> {
			Map<String, Object> record = new LinkedHashMap<>();
			record.put("kind", entry.kind());
			record.put("id", entry.id().toString());
			record.put("version", entry.version());
			record.put("stamp", entry.stamp().toString());
			record.put("read", entry.read());
			if (entry.application() != null) {
				record.put("status", entry.requireApplication().status());
				record.put("reviewStatus", entry.requireApplication().reviewStatus());
			}
			else {
				record.put("useCaseId", entry.requireProposal().useCaseId().toString());
			}
			return record;
		}).toList();
	}

	/**
	 * Why a candidate's tier differs from its previous one, from what changed among the records read; null when it is
	 * its first assessment or the tier is the same.
	 */
	static @Nullable String changeNote(@Nullable Latest previous, String tier, List<Map<String, Object>> records) {
		if (previous == null || previous.tier().equals(tier)) {
			return null;
		}
		Map<Object, Map<String, Object>> was = new LinkedHashMap<>();
		previous.records().forEach(record -> was.put(record.get("id"), record));
		List<String> changes = new ArrayList<>();
		for (Map<String, Object> record : records) {
			Map<String, Object> old = was.remove(record.get("id"));
			String kind = String.valueOf(record.get("kind"));
			if (old == null) {
				changes.add(Boolean.TRUE.equals(record.get("read")) ? kind + " added" : "draft started");
			}
			else if (EvaluationCandidates.APPLICATION.equals(kind)
					&& !Objects.equals(String.valueOf(old.get("version")), String.valueOf(record.get("version")))) {
				changes.add("application submitted again (version " + record.get("version") + ")");
			}
			else if (EvaluationCandidates.PROPOSAL.equals(kind)
					&& !Objects.equals(old.get("stamp"), record.get("stamp"))) {
				changes.add("proposal edited");
			}
		}
		was.values().forEach(gone -> changes.add(gone.get("kind") + " withdrawn"));
		return "Was " + previous.tier() + ": "
				+ (changes.isEmpty() ? "the use cases or the instructions changed" : String.join(", ", changes)) + ".";
	}

	private static Map<String, Object> notes(Assessed kept) {
		Map<String, Object> notes = new LinkedHashMap<>();
		notes.put("why", kept.notes().why());
		notes.put("concern", kept.notes().concern());
		notes.put("next", kept.notes().next());
		notes.put("rationale", kept.notes().rationale());
		notes.put("contradictions", kept.notes().contradictions());
		notes.put("questions", kept.notes().questions());
		notes.put("alignmentReason", kept.alignmentReason());
		notes.put("instructionsInSources", kept.instructionsInSources());
		return notes;
	}

	private static List<Map<String, Object>> criteria(Assessed kept) {
		return kept.criteria().stream().map(criterion -> {
			Map<String, Object> out = new LinkedHashMap<>();
			out.put("key", criterion.key());
			out.put("tractionKind", criterion.tractionKind());
			out.put("findings", criterion.findings().stream().map(finding -> {
				Map<String, Object> one = new LinkedHashMap<>();
				one.put("label", finding.label());
				one.put("summary", finding.summary());
				one.put("finding", finding.finding());
				one.put("gap", finding.gap());
				one.put("source", finding.source());
				one.put("quote", finding.quote());
				one.put("quoteState", finding.quoteState());
				one.put("lowered", finding.lowered());
				return one;
			}).toList());
			return out;
		}).toList();
	}

	private static Map<String, Object> gate(Assessed kept) {
		Map<String, Object> gate = new LinkedHashMap<>();
		gate.put("proposal", kept.gate().proposal());
		gate.put("earlyStage", kept.gate().earlyStage());
		gate.put("reason", kept.gate().reason());
		return gate;
	}

	private static List<Map<String, Object>> coverage(List<EvaluationSources.Coverage> coverage) {
		return coverage.stream().map(read -> {
			Map<String, Object> out = new LinkedHashMap<>();
			out.put("record", read.record());
			out.put("label", read.label());
			out.put("file", read.file());
			out.put("pages", read.pages());
			out.put("read", read.read());
			out.put("unread", read.unread());
			out.put("cut", read.cut());
			out.put("note", read.note());
			return out;
		}).toList();
	}

	private static String kind(Throwable failure) {
		return ProviderFailures.refused(failure) ? MatchingRuns.REQUEST_REFUSED : failure.getClass().getName();
	}

	/**
	 * A run could not go on now. It waits and continues, unless the request itself was refused or it has stopped too
	 * many times in a row without assessing anything; then it ends as failed.
	 */
	private void stop(Run run, int assessed, String failure) {
		int stalls = assessed > 0 ? 0 : run.stalls() + 1;
		boolean ends = MatchingRuns.REQUEST_REFUSED.equals(failure) || stalls > settings.maxStalls();
		if (ends) {
			evaluations.fail(run.id(), failure);
		}
		else {
			evaluations.waitUntil(run.id(), Instant.now().plus(settings.pause()), stalls, failure);
		}
		LOG.atWarn()
			.addKeyValue("event", ends ? "matching.evaluation_run.failed" : "matching.evaluation_run.waiting")
			.addKeyValue("run_id", run.id())
			.addKeyValue("error_type", failure)
			.addKeyValue("assessed", assessed)
			.log("An evaluation run stopped before it had assessed every candidate");
	}

}
