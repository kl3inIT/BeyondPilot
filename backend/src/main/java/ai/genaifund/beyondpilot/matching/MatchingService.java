package ai.genaifund.beyondpilot.matching;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.ai.AiModels;
import ai.genaifund.beyondpilot.ai.AiTask;
import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.matching.dto.AddCandidateRequest;
import ai.genaifund.beyondpilot.matching.dto.MatchingChange;
import ai.genaifund.beyondpilot.matching.dto.MatchingChange.Kind;
import ai.genaifund.beyondpilot.matching.dto.MatchingResponse;
import ai.genaifund.beyondpilot.matching.dto.RemoveCandidateRequest;
import ai.genaifund.beyondpilot.matching.dto.StartRunRequest;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Candidate;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.RunState;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Step;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.search.SolutionEvidence;
import ai.genaifund.beyondpilot.search.SolutionEvidence.Shown;
import ai.genaifund.beyondpilot.solution.IndexedSolution;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import ai.genaifund.beyondpilot.usecase.UseCaseBrief;
import ai.genaifund.beyondpilot.usecase.UseCaseDirectory;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;

/**
 * Matching as people use it: the members of the organization a use case belongs to, and GenAI Fund's operators. They
 * read the candidates with the reasons, start a run, and shortlist, remove and restore candidates; an operator also
 * adds a solution by hand. Anyone else is told there is no such use case. What a person decides is recorded with who
 * and when, and no run changes it. A page that stays open hears that something changed and reads again.
 */
@Service
public class MatchingService {

	private static final String USE_CASE = "use_case";

	/** What a member is told when a run stopped for a reason that is the AI provider's. */
	private static final String PROVIDER = "provider";

	/** The reasons of matching's own that a member may read. */
	private static final Set<String> MEMBER_REASONS = Set.of(MatchingRuns.NO_USE_CASE, MatchingRuns.NO_MODEL,
			MatchingRuns.NO_CAPABILITY);

	/** What a running run is doing, as the page names it. */
	private static final String READING_BRIEF = "brief";

	private static final String SEARCHING = "search";

	private static final String READING_SOLUTIONS = "reading";

	private final MatchingRepository matching;

	private final UseCaseDirectory useCases;

	private final SolutionDirectory solutions;

	private final SolutionEvidence evidence;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	private final AiModels models;

	private final AuditTrail audit;

	private final MatchingChanges changes;

	MatchingService(MatchingRepository matching, UseCaseDirectory useCases, SolutionDirectory solutions,
			SolutionEvidence evidence, OrganizationDirectory organizations, IdentityService identity, AiModels models,
			AuditTrail audit, MatchingChanges changes) {
		this.matching = matching;
		this.useCases = useCases;
		this.solutions = solutions;
		this.evidence = evidence;
		this.organizations = organizations;
		this.identity = identity;
		this.models = models;
		this.audit = audit;
		this.changes = changes;
	}

	/** The caller's right to a use case: its brief, and whether they act as an operator. */
	private record Access(UseCaseBrief brief, boolean operator) {
	}

	/**
	 * What matching holds for a use case.
	 * @throws MatchingException when the use case is not published, or the caller is neither an operator nor a member
	 * of its organization
	 */
	@Transactional(readOnly = true)
	public MatchingResponse get(Actor actor, UUID useCaseId) {
		return view(actor, access(actor, useCaseId));
	}

	/**
	 * The changes of what matching holds for a use case, from now on and for as long as the caller listens: that a run
	 * moved, that the brief is read, that solutions are found, that one is being read or is read, that a person
	 * decided. A change carries no state; the caller reads {@link #get} again. Who may listen is decided once, when
	 * the stream opens, by the rule of {@link #get}.
	 * @throws MatchingException when the use case is not published, or the caller is neither an operator nor a member
	 * of its organization
	 */
	@Transactional(readOnly = true)
	public Flux<MatchingChange> changes(Actor actor, UUID useCaseId) {
		access(actor, useCaseId);
		return changes.of(useCaseId);
	}

	/**
	 * Starts a run for a use case. A run that waits for the use case to stay unchanged starts at once instead.
	 * @throws MatchingException when the caller may not, no model is set, a run is at work, or a member started as
	 * many as a day allows
	 */
	@Transactional
	public MatchingResponse start(Actor actor, UUID useCaseId, StartRunRequest request) {
		Access access = access(actor, useCaseId);
		if (request.judgeAll() && !access.operator()) {
			throw new MatchingException(MatchingErrorCode.OPERATORS_ONLY, "A member asked to judge all again");
		}
		if (!models.available(AiTask.MATCHING)) {
			throw new MatchingException(MatchingErrorCode.NO_MODEL, "No usable model for matching");
		}
		String origin = access.operator() ? MatchingRepository.BY_OPERATOR : MatchingRepository.BY_MEMBER;
		if (!access.operator() && runsLeft(useCaseId) <= 0) {
			throw new MatchingException(MatchingErrorCode.RUN_LIMIT, "Members ran use case " + useCaseId + " enough today");
		}
		boolean queued = matching.queue(useCaseId, origin, actor.accountId(), Prompts.VERSION, null, request.judgeAll())
			.isPresent();
		// A run a change queued, still waiting for its moment, is what the person asks for: it starts now.
		if (!queued && !matching.startNow(useCaseId)) {
			throw new MatchingException(MatchingErrorCode.RUN_OPEN, "A run of use case " + useCaseId + " is at work");
		}
		record(AuditAction.MATCHING_RUN_START, actor, access.brief(), Map.of("origin", origin));
		changes.tell(useCaseId, Kind.RUN);
		return view(actor, access);
	}

	/**
	 * Puts an approved solution among the candidates by hand; the next run judges it.
	 * @throws MatchingException when the caller is not an operator, the solution is not approved, is the
	 * organization's own, or is a candidate already
	 */
	@Transactional
	public MatchingResponse add(Actor actor, UUID useCaseId, AddCandidateRequest request) {
		Access access = access(actor, useCaseId);
		if (!access.operator()) {
			throw new MatchingException(MatchingErrorCode.OPERATORS_ONLY, "A member asked to add a candidate");
		}
		IndexedSolution solution = solutions.indexed(request.solutionId())
			.orElseThrow(() -> new MatchingException(MatchingErrorCode.SOLUTION_NOT_FOUND,
					"No approved solution " + request.solutionId()));
		if (solution.organizationId().equals(access.brief().organizationId())) {
			throw new MatchingException(MatchingErrorCode.OWN_SOLUTION, "Solution " + solution.id() + " is the organization's");
		}
		matching.add(useCaseId, solution.id(), actor.accountId())
			.orElseThrow(() -> new MatchingException(MatchingErrorCode.ALREADY_CANDIDATE,
					"Solution " + solution.id() + " is a candidate of use case " + useCaseId));
		record(AuditAction.MATCHING_CANDIDATE_ADD, actor, access.brief(), Map.of("solution", solution.name()));
		// It is judged by a run; one is queued unless one is at work, which the operator then starts again.
		if (models.available(AiTask.MATCHING)) {
			matching.queue(useCaseId, MatchingRepository.BY_OPERATOR, actor.accountId(), Prompts.VERSION, null, false);
		}
		changes.tell(useCaseId, Kind.DECISION);
		return view(actor, access);
	}

	/**
	 * Puts a candidate on the shortlist.
	 * @throws MatchingException when the candidate is unknown to the caller or was removed
	 */
	@Transactional
	public MatchingResponse shortlist(Actor actor, UUID candidateId) {
		Candidate candidate = candidate(candidateId);
		Access access = access(actor, candidate);
		if (MatchingRepository.REMOVED.equals(candidate.decision())) {
			throw new MatchingException(MatchingErrorCode.CANDIDATE_REMOVED, "Candidate " + candidateId + " is removed");
		}
		if (!MatchingRepository.SHORTLISTED.equals(candidate.decision())) {
			decide(actor, access, candidate, MatchingRepository.SHORTLISTED, null, null,
					AuditAction.MATCHING_CANDIDATE_SHORTLIST);
		}
		return view(actor, access);
	}

	/**
	 * Takes a candidate off the list, with the reason; it leaves the shortlist too.
	 * @throws MatchingException when the candidate is unknown to the caller
	 */
	@Transactional
	public MatchingResponse remove(Actor actor, UUID candidateId, RemoveCandidateRequest request) {
		Candidate candidate = candidate(candidateId);
		Access access = access(actor, candidate);
		String note = request.note() == null || request.note().isBlank() ? null : request.note().strip();
		if (!MatchingRepository.REMOVED.equals(candidate.decision())) {
			decide(actor, access, candidate, MatchingRepository.REMOVED, request.reason(), note,
					AuditAction.MATCHING_CANDIDATE_REMOVE);
		}
		return view(actor, access);
	}

	/**
	 * Puts a candidate back as nobody had decided on it: off the shortlist, or back on the list.
	 * @throws MatchingException when the candidate is unknown to the caller, or GenAI Fund removed it and the caller
	 * is a member
	 */
	@Transactional
	public MatchingResponse restore(Actor actor, UUID candidateId) {
		Candidate candidate = candidate(candidateId);
		Access access = access(actor, candidate);
		if (MatchingRepository.REMOVED.equals(candidate.decision()) && candidate.decidedByOperator()
				&& !access.operator()) {
			throw new MatchingException(MatchingErrorCode.REMOVED_BY_OPERATOR,
					"Candidate " + candidateId + " was removed by an operator");
		}
		if (!MatchingRepository.UNDECIDED.equals(candidate.decision())) {
			decide(actor, access, candidate, MatchingRepository.RESTORED, null, null,
					AuditAction.MATCHING_CANDIDATE_RESTORE);
		}
		return view(actor, access);
	}

	private Candidate candidate(UUID candidateId) {
		return matching.candidate(candidateId)
			.orElseThrow(() -> new MatchingException(MatchingErrorCode.CANDIDATE_NOT_FOUND, "No candidate " + candidateId));
	}

	private void decide(Actor actor, Access access, Candidate candidate, String kind, @Nullable String reason,
			@Nullable String note, AuditAction action) {
		matching.decide(candidate.id(), kind, reason, note, actor.accountId(), access.operator());
		changes.tell(candidate.useCaseId(), Kind.DECISION);
		Shown shown = evidence.shown(List.of(candidate.solutionId())).get(candidate.solutionId());
		String solution = shown == null ? candidate.solutionId().toString() : shown.name();
		record(action, actor, access.brief(),
				reason == null ? Map.of("solution", solution) : Map.of("solution", solution, "reason", reason));
	}

	/**
	 * @throws MatchingException when the use case is not published, or the caller is neither an operator nor a member
	 * of its approved organization; both read the same, so a stranger learns nothing
	 */
	private Access access(Actor actor, UUID useCaseId) {
		UseCaseBrief brief = useCases.brief(useCaseId).orElseThrow(() -> notFound(useCaseId));
		boolean operator = identity.isOperator(actor);
		if (!operator) {
			organizations.membershipOf(actor)
				.filter(Membership::approved)
				.filter(membership -> membership.organizationId().equals(brief.organizationId()))
				.orElseThrow(() -> notFound(useCaseId));
		}
		return new Access(brief, operator);
	}

	/**
	 * The caller's right to the use case of a candidate. A caller without it is told what a caller is told of a
	 * candidate that does not exist, so that nobody learns which identifiers are candidates.
	 */
	private Access access(Actor actor, Candidate candidate) {
		try {
			return access(actor, candidate.useCaseId());
		}
		catch (MatchingException hidden) {
			throw new MatchingException(MatchingErrorCode.CANDIDATE_NOT_FOUND,
					"Candidate " + candidate.id() + " is not this caller's to see");
		}
	}

	private static MatchingException notFound(UUID useCaseId) {
		return new MatchingException(MatchingErrorCode.USE_CASE_NOT_FOUND, "No use case " + useCaseId + " for this caller");
	}

	private int runsLeft(UUID useCaseId) {
		return Math.max(0, matching.settings().memberRunsPerDay()
				- matching.queuedToday(useCaseId, MatchingRepository.BY_MEMBER));
	}

	private MatchingResponse view(Actor actor, Access access) {
		UUID useCaseId = access.brief().id();
		boolean operator = access.operator();
		List<Candidate> kept = matching.candidates(useCaseId);
		Map<UUID, Shown> shown = evidence.shown(kept.stream().map(Candidate::solutionId).toList());
		// Who removed what is shown to both sides, by the name each person has now.
		Map<UUID, Person> people = identity.people(kept.stream()
			.filter(candidate -> MatchingRepository.REMOVED.equals(candidate.decision()))
			.map(Candidate::decidedBy)
			.filter(Objects::nonNull)
			.collect(Collectors.toSet()));
		// A candidate whose solution is no longer shown anywhere is hidden; it comes back with its solution.
		List<MatchingResponse.Candidate> candidates = new ArrayList<>();
		int judged = 0;
		for (Candidate candidate : kept) {
			Shown solution = shown.get(candidate.solutionId());
			if (solution == null) {
				continue;
			}
			judged += candidate.judged() ? 1 : 0;
			boolean removed = MatchingRepository.REMOVED.equals(candidate.decision());
			// A member is not told which operator removed a candidate, only that GenAI Fund did.
			Person remover = removed && candidate.decidedBy() != null && (operator || !candidate.decidedByOperator())
					? people.get(candidate.decidedBy()) : null;
			candidates.add(new MatchingResponse.Candidate(candidate.id(), candidate.solutionId(), solution.slug(),
					solution.name(), solution.organizationName(), solution.logoFileId(), solution.country(),
					solution.maturity(), solution.listed(), candidate.origin(),
					candidate.bucket(), candidate.requiredMet(), candidate.requiredTotal(), candidate.decision(),
					candidate.reason(), candidate.note(), remover == null ? null : remover.label(),
					removed ? candidate.decidedByOperator() : null, removed ? candidate.decidedAt() : null,
					candidate.judged(), candidate.summary(), candidate.unread(),
					findings(candidate.findings().get("requirements")), finding(candidate.findings().get("problem")),
					finding(candidate.findings().get("industry")), finding(candidate.findings().get("technology"))));
		}
		RunState last = matching.lastRun(useCaseId).orElse(null);
		int total = candidates.size();
		int done = judged;
		boolean running = last != null && MatchingRepository.RUNNING.equals(last.state());
		// The steps say how far a run is, for everyone; what each cost is the operators' to read.
		List<Step> worked = last != null && (operator || running) ? matching.steps(last.id()) : List.of();
		MatchingResponse.Run run = last == null ? null
				: new MatchingResponse.Run(last.id(), last.state(), running ? stage(worked) : null, last.origin(),
						last.createdAt(), last.notBefore(), last.startedAt(), last.endedAt(), last.resumeAt(),
						failure(last.failure(), operator), done, total, operator ? last.modelName() : null);
		List<MatchingResponse.Step> steps = !operator ? List.of()
				: worked.stream()
					.map(step -> new MatchingResponse.Step(step.name(), step.takenIn(), step.givenOut(), step.calls(),
							step.inputTokens(), step.outputTokens(), step.millis()))
					.toList();
		List<MatchingResponse.Requirement> requirements = matching.requirements(useCaseId)
			.stream()
			.map(requirement -> new MatchingResponse.Requirement(requirement.position(), requirement.kind(),
					requirement.necessity(), requirement.label(), requirement.statement(), requirement.quote()))
			.toList();
		return new MatchingResponse(useCaseId, operator, models.available(AiTask.MATCHING),
				operator ? null : runsLeft(useCaseId), run, requirements, candidates, steps);
	}

	/**
	 * What a run that is at work is doing, from the steps it has kept: a step is kept when it ends, so the run is at
	 * the first one it has not kept. A run that continues after a wait has kept them all and is reading solutions,
	 * which is where its time goes: the brief is not read twice, and the search takes a moment.
	 */
	private static String stage(List<Step> kept) {
		List<String> names = kept.stream().map(Step::name).toList();
		if (!names.contains(MatchingRepository.REQUIREMENTS)) {
			return READING_BRIEF;
		}
		return names.contains(MatchingRepository.CANDIDATES) ? READING_SOLUTIONS : SEARCHING;
	}

	/**
	 * Why a run failed or waits, as the caller may know it. An operator reads the kind of failure the run kept; a
	 * member reads only one of matching's own reasons, and "provider" for anything that happened at the AI provider.
	 */
	private static @Nullable String failure(@Nullable String kept, boolean operator) {
		if (kept == null || operator || MEMBER_REASONS.contains(kept)) {
			return kept;
		}
		return PROVIDER;
	}

	private static List<MatchingResponse.Finding> findings(@Nullable Object kept) {
		List<MatchingResponse.Finding> findings = new ArrayList<>();
		if (kept instanceof List<?> list) {
			for (Object one : list) {
				MatchingResponse.Finding finding = finding(one);
				if (finding != null) {
					findings.add(finding);
				}
			}
		}
		return findings;
	}

	/** One finding as it was kept; a judgment made before reasons were kept has none. */
	private static MatchingResponse.@Nullable Finding finding(@Nullable Object kept) {
		if (!(kept instanceof Map<?, ?> map)) {
			return null;
		}
		return new MatchingResponse.Finding(map.get("requirement") instanceof Number place ? place.intValue() : null,
				text(map.get("status"), Judgment.NOT_SHOWN), text(map.get("quote"), ""), text(map.get("source"), ""),
				text(map.get("reason"), ""), text(map.get("quoteState"), Quotes.NONE));
	}

	private static String text(@Nullable Object value, String otherwise) {
		return value instanceof String text ? text : otherwise;
	}

	private void record(AuditAction action, Actor actor, UseCaseBrief brief, Map<String, String> details) {
		Person person = identity.person(actor);
		audit.record(new AuditRecord(action, new AuditRecord.Actor(person.accountId(), person.label(), person.email()),
				new AuditRecord.Resource(USE_CASE, brief.id().toString(), brief.title()), details));
	}

}
