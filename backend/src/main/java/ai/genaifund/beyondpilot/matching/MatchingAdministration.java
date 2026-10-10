package ai.genaifund.beyondpilot.matching;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.matching.dto.MatchingFeedbackListRequest;
import ai.genaifund.beyondpilot.matching.dto.MatchingFeedbackListResponse;
import ai.genaifund.beyondpilot.matching.dto.MatchingSettingsResponse;
import ai.genaifund.beyondpilot.matching.dto.SaveMatchingSettingsRequest;
import ai.genaifund.beyondpilot.matching.persistence.MatchingFeedbackRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingFeedbackRepository.Disagreement;
import ai.genaifund.beyondpilot.matching.persistence.MatchingFeedbackRepository.Totals;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Requirement;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Settings;
import ai.genaifund.beyondpilot.search.SolutionEvidence;
import ai.genaifund.beyondpilot.search.SolutionEvidence.Shown;
import ai.genaifund.beyondpilot.usecase.IndexedUseCase;
import ai.genaifund.beyondpilot.usecase.UseCaseDirectory;
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
	static final int FEEDBACK_PAGE_SIZE = 20;

	/** How far back the answers are counted. */
	private static final Duration FEEDBACK_PERIOD = Duration.ofDays(30);

	private final MatchingRepository matching;

	private final MatchingFeedbackRepository feedback;

	private final UseCaseDirectory useCases;

	private final SolutionEvidence evidence;

	private final IdentityService identity;

	private final AuditTrail audit;

	MatchingAdministration(MatchingRepository matching, MatchingFeedbackRepository feedback, UseCaseDirectory useCases,
			SolutionEvidence evidence, IdentityService identity, AuditTrail audit) {
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
		Totals totals = feedback.totals(Instant.now().minus(FEEDBACK_PERIOD));
		List<Disagreement> rows = feedback.disagreements(FEEDBACK_PAGE_SIZE, (long) (page - 1) * FEEDBACK_PAGE_SIZE);
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
		return new MatchingFeedbackListResponse(totals.answers(), totals.agreements(), items, page, FEEDBACK_PAGE_SIZE,
				feedback.disagreementCount());
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
