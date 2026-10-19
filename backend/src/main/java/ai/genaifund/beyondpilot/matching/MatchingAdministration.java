package ai.genaifund.beyondpilot.matching;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.ai.AiSubjectUsage;
import ai.genaifund.beyondpilot.ai.AiUsageReports;
import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.matching.dto.MatchingFeedbackListRequest;
import ai.genaifund.beyondpilot.matching.dto.MatchingFeedbackListResponse;
import ai.genaifund.beyondpilot.matching.dto.MatchingRunListRequest;
import ai.genaifund.beyondpilot.matching.dto.MatchingRunListResponse;
import ai.genaifund.beyondpilot.matching.dto.MatchingRunResponse;
import ai.genaifund.beyondpilot.matching.dto.MatchingRunSummary;
import ai.genaifund.beyondpilot.matching.dto.MatchingSettingsResponse;
import ai.genaifund.beyondpilot.matching.dto.SaveMatchingSettingsRequest;
import ai.genaifund.beyondpilot.matching.persistence.MatchingFeedbackRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingFeedbackRepository.Disagreement;
import ai.genaifund.beyondpilot.matching.persistence.MatchingFeedbackRepository.Totals;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Requirement;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Settings;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRunHistory;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRunHistory.Judgment;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRunHistory.Run;
import ai.genaifund.beyondpilot.search.SolutionEvidence;
import ai.genaifund.beyondpilot.search.SolutionEvidence.Shown;
import ai.genaifund.beyondpilot.usecase.IndexedUseCase;
import ai.genaifund.beyondpilot.usecase.UseCaseDirectory;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Matching as operators run it in Admin. The limits they set: how long a changed use case waits before its run, how
 * many runs a day its changes and its members may start, how many runs a day start in all, how many solutions a run
 * judges, and how many of them at the same time; each change is recorded in the audit log. And what people said about
 * the groups the AI gave, which is how GenAI Fund learns whether matching judges well.
 */
@Service
public class MatchingAdministration {

	/** How many disagreements a page holds. */
	static final int FEEDBACK_PAGE_SIZE = 25;

	/** How far back the answers are counted. */
	private static final Duration FEEDBACK_PERIOD = Duration.ofDays(30);

	/** How many runs a page of the list holds. */
	static final int RUN_PAGE_SIZE = 50;

	private final MatchingRepository matching;

	private final MatchingFeedbackRepository feedback;

	private final UseCaseDirectory useCases;

	private final SolutionEvidence evidence;

	private final IdentityService identity;

	private final AuditTrail audit;

	private final MatchingRunHistory history;

	private final AiUsageReports usage;

	MatchingAdministration(MatchingRepository matching, MatchingFeedbackRepository feedback, UseCaseDirectory useCases,
			SolutionEvidence evidence, IdentityService identity, AuditTrail audit, MatchingRunHistory history,
			AiUsageReports usage) {
		this.history = history;
		this.usage = usage;
		this.matching = matching;
		this.feedback = feedback;
		this.useCases = useCases;
		this.evidence = evidence;
		this.identity = identity;
		this.audit = audit;
	}

	/**
	 * What people said about the groups the AI gave: how many answered in the last 30 days and how many of them
	 * agreed, and one page of the answers that say a group is wrong, newest first and whenever they were given. A
	 * person's last answer about a judgment is the one that counts. A page past the end is empty.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public MatchingFeedbackListResponse feedback(Actor actor, MatchingFeedbackListRequest request) {
		identity.requireOperator(actor);
		int page = request.page() == null ? 1 : request.page();
		int size = request.size() == null ? FEEDBACK_PAGE_SIZE : request.size();
		Totals totals = feedback.totals(Instant.now().minus(FEEDBACK_PERIOD));
		List<Disagreement> rows = feedback.disagreements(size, (long) (page - 1) * size);
		Map<UUID, Shown> solutions = evidence.shown(rows.stream().map(Disagreement::solutionId).collect(Collectors.toSet()));
		Map<UUID, Person> people = identity.people(rows.stream().map(Disagreement::accountId).collect(Collectors.toSet()));
		// A page holds the disagreements of a few use cases; each is read once.
		Map<UUID, String> titles = new HashMap<>();
		Map<UUID, Map<Integer, Requirement>> requirements = new HashMap<>();
		for (UUID useCaseId : rows.stream().map(Disagreement::useCaseId).collect(Collectors.toSet())) {
			useCases.indexed(useCaseId).map(IndexedUseCase::title).ifPresent(title -> titles.put(useCaseId, title));
			requirements.put(useCaseId, matching.requirements(useCaseId)
				.stream()
				.collect(Collectors.toMap(Requirement::position, requirement -> requirement)));
		}
		List<MatchingFeedbackListResponse.Item> items = rows.stream().map(row -> {
			Shown solution = solutions.get(row.solutionId());
			Person person = people.get(row.accountId());
			// The requirements kept now are those an answer names only while its judgment is the candidate's.
			Map<Integer, Requirement> kept = row.current() ? requirements.getOrDefault(row.useCaseId(), Map.of())
					: Map.of();
			List<MatchingFeedbackListResponse.Disputed> disputed = row.requirements().stream().map(position -> {
				Requirement requirement = kept.get(position);
				return new MatchingFeedbackListResponse.Disputed(position,
						requirement == null ? null : requirement.label(),
						requirement == null ? null : requirement.statement());
			}).toList();
			return new MatchingFeedbackListResponse.Item(row.id(), row.useCaseId(), titles.get(row.useCaseId()),
					row.candidateId(), row.solutionId(), solution == null ? null : solution.name(), row.aiBucket(),
					row.expectedBucket(), disputed, row.note(), person == null ? null : person.label(), row.createdAt());
		}).toList();
		return new MatchingFeedbackListResponse(totals.answers(), totals.agreements(), items, page, size,
				feedback.disagreementCount());
	}

	/**
	 * One page of the runs of every use case, the newest first, each with what its calls to the AI came to. A page past
	 * the end is empty.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public MatchingRunListResponse runs(Actor actor, MatchingRunListRequest request) {
		identity.requireOperator(actor);
		int page = request.page() == null ? 1 : request.page();
		int size = request.size() == null ? RUN_PAGE_SIZE : request.size();
		List<MatchingRunSummary> items = summaries(history.runs(size, (long) (page - 1) * size));
		return new MatchingRunListResponse(items, page, size, history.count());
	}

	/**
	 * One run in detail: what it cost, its steps, and which solutions changed group since the run of the same use case
	 * before it, when both kept the group of each solution.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws MatchingException when there is no such run
	 */
	@Transactional(readOnly = true)
	public MatchingRunResponse run(Actor actor, UUID runId) {
		identity.requireOperator(actor);
		Run run = history.run(runId)
			.orElseThrow(() -> new MatchingException(MatchingErrorCode.RUN_NOT_FOUND, "No run " + runId));
		List<MatchingRunResponse.Step> steps = matching.steps(runId)
			.stream()
			.map(step -> new MatchingRunResponse.Step(step.name(), step.takenIn(), step.givenOut(), step.calls(),
					step.inputTokens(), step.outputTokens(), step.millis()))
			.toList();
		UUID previousId = history.previous(runId).orElse(null);
		Map<UUID, Judgment> now = bySolution(history.judgments(runId));
		Map<UUID, Judgment> before = previousId == null ? Map.of() : bySolution(history.judgments(previousId));
		boolean compared = !now.isEmpty() && !before.isEmpty();
		List<MatchingRunResponse.Group> groups = List.of();
		List<MatchingRunResponse.Move> moves = List.of();
		if (compared) {
			groups = BUCKETS.stream()
				.map(bucket -> new MatchingRunResponse.Group(bucket, count(before, bucket), count(now, bucket)))
				.toList();
			Set<UUID> solutionIds = new LinkedHashSet<>(before.keySet());
			solutionIds.addAll(now.keySet());
			Map<UUID, Shown> shown = evidence.shown(solutionIds);
			moves = solutionIds.stream()
				.filter(id -> !Objects.equals(bucket(before, id), bucket(now, id)))
				.map(id -> {
					Shown solution = shown.get(id);
					return new MatchingRunResponse.Move(id, solution == null ? null : solution.name(),
							bucket(before, id), bucket(now, id));
				})
				.sorted(Comparator.comparing(move -> move.solutionName() == null ? "" : move.solutionName()))
				.toList();
		}
		return new MatchingRunResponse(summaries(List.of(run)).getFirst(), steps, previousId, compared, groups, moves);
	}

	/**
	 * {@link #runs} for another module.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public MatchingRunList runList(Actor actor, int page, int size) {
		MatchingRunListResponse found = runs(actor, new MatchingRunListRequest(page, size));
		return new MatchingRunList(found.items().stream().map(MatchingAdministration::published).toList(),
				found.page(), found.pageSize(), found.total());
	}

	/**
	 * {@link #run} for another module.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws MatchingException when there is no such run
	 */
	@Transactional(readOnly = true)
	public MatchingRunDetail runDetail(Actor actor, UUID runId) {
		MatchingRunResponse found = run(actor, runId);
		return new MatchingRunDetail(published(found.run()),
				found.steps()
					.stream()
					.map(step -> new MatchingRunDetail.Step(step.name(), step.takenIn(), step.givenOut(), step.calls(),
							step.inputTokens(), step.outputTokens(), step.millis()))
					.toList(),
				found.previousRunId(), found.compared(),
				found.groups()
					.stream()
					.map(group -> new MatchingRunDetail.Group(group.bucket(), group.before(), group.after()))
					.toList(),
				found.moves()
					.stream()
					.map(move -> new MatchingRunDetail.Move(move.solutionId(), move.solutionName(), move.before(),
							move.after()))
					.toList());
	}

	private static MatchingRunList.Run published(MatchingRunSummary run) {
		return new MatchingRunList.Run(run.id(), run.useCaseId(), run.useCaseTitle(), run.state(), run.origin(),
				run.startedBy(), run.modelName(), run.failure(), run.createdAt(), run.startedAt(), run.endedAt(),
				run.judged(), run.kept(), run.calls(), run.failedCalls(), run.inputTokens(), run.outputTokens(),
				run.cost());
	}

	/** The groups, strongest first, as the comparison of two runs counts them. */
	private static final List<String> BUCKETS = List.of("direct", "industry", "technology", "none");

	private List<MatchingRunSummary> summaries(List<Run> runs) {
		Map<String, AiSubjectUsage> used = usage.ofSubjects(MatchingRuns.SUBJECT,
				runs.stream().map(run -> run.id().toString()).toList());
		Map<UUID, Person> people = identity.people(
				runs.stream().map(Run::startedBy).filter(Objects::nonNull).collect(Collectors.toSet()));
		Map<UUID, String> titles = new HashMap<>();
		for (UUID useCaseId : runs.stream().map(Run::useCaseId).collect(Collectors.toSet())) {
			useCases.indexed(useCaseId).map(IndexedUseCase::title).ifPresent(title -> titles.put(useCaseId, title));
		}
		AiSubjectUsage nothing = new AiSubjectUsage(0, 0, 0, 0, 0, 0, null, 0);
		return runs.stream().map(run -> {
			AiSubjectUsage calls = used.getOrDefault(run.id().toString(), nothing);
			UUID startedBy = run.startedBy();
			Person starter = startedBy == null ? null : people.get(startedBy);
			return new MatchingRunSummary(run.id(), run.useCaseId(), titles.get(run.useCaseId()), run.state(),
					run.origin(), starter == null ? null : starter.label(), run.promptVersion(), run.modelName(),
					run.failure(), run.createdAt(), run.startedAt(), run.endedAt(), run.judged(), run.kept(),
					calls.calls(), calls.failed(), calls.inputTokens(), calls.outputTokens(), calls.cacheReadTokens(),
					calls.cacheWriteTokens(), calls.cost(), calls.unpriced());
		}).toList();
	}

	private static Map<UUID, Judgment> bySolution(List<Judgment> judgments) {
		return judgments.stream().collect(Collectors.toMap(Judgment::solutionId, judgment -> judgment));
	}

	private static int count(Map<UUID, Judgment> judgments, String bucket) {
		return (int) judgments.values().stream().filter(judgment -> judgment.bucket().equals(bucket)).count();
	}

	private static @Nullable String bucket(Map<UUID, Judgment> judgments, UUID solutionId) {
		Judgment judgment = judgments.get(solutionId);
		return judgment == null ? null : judgment.bucket();
	}

	/** @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator */
	@Transactional(readOnly = true)
	public MatchingSettingsResponse settings(Actor actor) {
		identity.requireOperator(actor);
		return response(matching.settings());
	}

	/**
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws MatchingException when the settings changed since the operator read them
	 */
	@Transactional
	public MatchingSettingsResponse save(Actor actor, SaveMatchingSettingsRequest request) {
		Operator operator = identity.requireOperator(actor);
		boolean saved = matching.saveSettings(new Settings(request.settleMinutes(), request.editRunsPerDay(),
				request.memberRunsPerDay(), request.runsPerDay(), request.candidates(), request.parallel(),
				request.version()));
		if (!saved) {
			throw new MatchingException(MatchingErrorCode.SETTINGS_CHANGED,
					"Matching settings are no longer at version " + request.version());
		}
		audit.record(new AuditRecord(AuditAction.MATCHING_SETTINGS_CHANGE,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource("matching_settings", "settings", "Matching settings"), Map.of()));
		return response(matching.settings());
	}

	private static MatchingSettingsResponse response(Settings settings) {
		return new MatchingSettingsResponse(settings.settleMinutes(), settings.editRunsPerDay(),
				settings.memberRunsPerDay(), settings.runsPerDay(), settings.candidates(), settings.parallel(),
				settings.version());
	}

}
