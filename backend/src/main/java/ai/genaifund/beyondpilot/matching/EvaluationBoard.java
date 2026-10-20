package ai.genaifund.beyondpilot.matching;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import ai.genaifund.beyondpilot.ai.AiModels;
import ai.genaifund.beyondpilot.ai.AiTask;
import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.matching.EvaluationCandidates.Candidate;
import ai.genaifund.beyondpilot.matching.EvaluationCandidates.Entry;
import ai.genaifund.beyondpilot.matching.dto.EvaluationBoardResponse;
import ai.genaifund.beyondpilot.matching.dto.EvaluationCandidateResponse;
import ai.genaifund.beyondpilot.matching.dto.StartEvaluationRequest;
import ai.genaifund.beyondpilot.matching.persistence.EvaluationRepository;
import ai.genaifund.beyondpilot.matching.persistence.EvaluationRepository.Assessed;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.proposal.ProgramSubmission;
import ai.genaifund.beyondpilot.proposal.ReviewService;
import ai.genaifund.beyondpilot.proposal.SentUseCaseProposal;
import ai.genaifund.beyondpilot.usecase.UseCaseBrief;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * A program's evaluation board, for operators (BEY-234): every submission grouped as candidates, each with the tier the
 * AI suggests and the evidence behind it, and the runs that assess them. Nothing here decides: decisions stay on the
 * applications and the proposals.
 */
@Service
public class EvaluationBoard {

	private static final TypeReference<List<EvaluationBoardResponse.Criterion>> CRITERIA = new TypeReference<>() {
	};

	private static final TypeReference<List<EvaluationBoardResponse.Coverage>> COVERAGE = new TypeReference<>() {
	};

	private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {
	};

	private final IdentityService identity;

	private final EvaluationRepository evaluations;

	private final EvaluationRuns runs;

	private final OrganizationDirectory organizations;

	private final AiModels models;

	private final AuditTrail audit;

	private final JsonMapper json;

	private final ReviewService applications;

	EvaluationBoard(IdentityService identity, EvaluationRepository evaluations, EvaluationRuns runs,
			OrganizationDirectory organizations, AiModels models, AuditTrail audit, JsonMapper json,
			ReviewService applications) {
		this.applications = applications;
		this.identity = identity;
		this.evaluations = evaluations;
		this.runs = runs;
		this.organizations = organizations;
		this.models = models;
		this.audit = audit;
		this.json = json;
	}

	/**
	 * The board of a program: its candidates, the latest assessed first, then those waiting.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public EvaluationBoardResponse board(Actor actor, UUID programId) {
		identity.requireOperator(actor);
		List<UseCaseBrief> briefs = runs.briefs(programId);
		List<Candidate> candidates = runs.candidates(programId, briefs);
		List<String> prints = briefs.stream().map(Requirements::fingerprint).toList();
		Map<List<UUID>, Assessed> current = new HashMap<>();
		evaluations.current(programId)
			.forEach(assessed -> current.put(List.of(assessed.organizationId(), assessed.solutionId()), assessed));
		Map<UUID, OrganizationName> names = names(candidates);
		List<EvaluationBoardResponse.Candidate> shown = candidates.stream()
			.map(candidate -> candidate(candidate, current.get(key(candidate)), prints, names))
			.sorted(Comparator
				.comparing((EvaluationBoardResponse.Candidate shownOne) -> shownOne.assessment() == null ? 1 : 0)
				.thenComparing(shownOne -> shownOne.assessment() == null ? "" : shownOne.assessment().assessedAt().toString(),
						Comparator.reverseOrder())
				.thenComparing(EvaluationBoardResponse.Candidate::organizationName))
			.toList();
		return new EvaluationBoardResponse(programId, models.available(AiTask.EVALUATION),
				briefs.stream().map(brief -> new EvaluationBoardResponse.UseCase(brief.id(), brief.title())).toList(),
				evaluations.lastRun(programId).map(EvaluationBoard::run).orElse(null), shown);
	}

	/**
	 * One candidate with its current assessment and the earlier ones.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws MatchingException when the program has no such candidate now
	 */
	@Transactional(readOnly = true)
	public EvaluationCandidateResponse candidate(Actor actor, UUID programId, UUID organizationId, UUID solutionId) {
		identity.requireOperator(actor);
		List<UseCaseBrief> briefs = runs.briefs(programId);
		Candidate candidate = runs.candidates(programId, briefs)
			.stream()
			.filter(found -> found.organizationId().equals(organizationId) && found.solutionId().equals(solutionId))
			.findFirst()
			.orElseThrow(() -> new MatchingException(MatchingErrorCode.EVALUATION_CANDIDATE_NOT_FOUND,
					"No candidate " + organizationId + "/" + solutionId + " of program " + programId));
		List<Assessed> history = evaluations.history(programId, organizationId, solutionId);
		EvaluationBoardResponse.Candidate shown = candidate(candidate, history.isEmpty() ? null : history.getFirst(),
				briefs.stream().map(Requirements::fingerprint).toList(), names(List.of(candidate)));
		return new EvaluationCandidateResponse(shown,
				history.stream()
					.skip(1)
					.map(earlier -> new EvaluationCandidateResponse.Earlier(earlier.id(), earlier.tier(),
							earlier.provisional(), earlier.changeNote(), earlier.modelName(), earlier.assessedAt()))
					.toList());
	}

	/**
	 * Starts a run of the program now; a run a change queued and that waits for its moment starts at once instead.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws MatchingException when no model is set for evaluation, the program has no approved use case, or a run of
	 * it is at work
	 */
	@Transactional
	public EvaluationBoardResponse start(Actor actor, UUID programId, StartEvaluationRequest request) {
		identity.requireOperator(actor);
		if (!models.available(AiTask.EVALUATION)) {
			throw new MatchingException(MatchingErrorCode.EVALUATION_NO_MODEL, "No usable model for evaluation");
		}
		if (runs.briefs(programId).isEmpty()) {
			throw new MatchingException(MatchingErrorCode.EVALUATION_NO_USE_CASE,
					"Program " + programId + " has no approved use case");
		}
		boolean queued = evaluations
			.queue(programId, EvaluationRepository.BY_OPERATOR, actor.accountId(), EvaluationPrompts.VERSION, null,
					request.assessAll())
			.isPresent();
		if (!queued && !evaluations.startNow(programId, request.assessAll())) {
			throw new MatchingException(MatchingErrorCode.EVALUATION_RUN_OPEN,
					"An evaluation run of program " + programId + " is at work");
		}
		Person person = identity.person(actor);
		audit.record(new AuditRecord(AuditAction.MATCHING_EVALUATION_START,
				new AuditRecord.Actor(person.accountId(), person.label(), person.email()),
				new AuditRecord.Resource("program", programId.toString(),
						applications.programName(programId).orElse(programId.toString())),
				Map.of("assess_all", String.valueOf(request.assessAll()))));
		return board(actor, programId);
	}

	private EvaluationBoardResponse.Candidate candidate(Candidate candidate, @Nullable Assessed assessed,
			List<String> prints, Map<UUID, OrganizationName> names) {
		String state = assessed == null ? "waiting"
				: assessed.fingerprint().equals(candidate.fingerprint(EvaluationPrompts.VERSION, prints)) ? "assessed"
						: "outdated";
		return new EvaluationBoardResponse.Candidate(candidate.organizationId(),
				organizationName(candidate, names), candidate.solutionId(), solutionName(candidate), state,
				candidate.records().stream().map(EvaluationBoard::record).toList(),
				assessed == null ? null : assessment(assessed));
	}

	private EvaluationBoardResponse.Assessment assessment(Assessed assessed) {
		Map<String, Object> notes = json.readValue(assessed.notes(), MAP);
		return new EvaluationBoardResponse.Assessment(assessed.id(), assessed.tier(), assessed.provisional(),
				assessed.alignment(), text(notes.get("alignmentReason")),
				json.readValue(assessed.gate(), EvaluationBoardResponse.Gate.class),
				json.readValue(assessed.criteria(), CRITERIA),
				new EvaluationBoardResponse.Notes(text(notes.get("why")), text(notes.get("concern")),
						text(notes.get("next")), text(notes.get("rationale")), texts(notes.get("contradictions")),
						texts(notes.get("questions"))),
				json.readValue(assessed.coverage(), COVERAGE), Boolean.TRUE.equals(notes.get("instructionsInSources")),
				assessed.changeNote(), assessed.modelName(), assessed.assessedAt());
	}

	private static EvaluationBoardResponse.Record record(Entry entry) {
		ProgramSubmission application = entry.application();
		if (application != null) {
			return new EvaluationBoardResponse.Record(entry.kind(), entry.id(), application.status(),
					application.reviewStatus(), null, entry.version(), entry.stamp());
		}
		SentUseCaseProposal proposal = entry.requireProposal();
		return new EvaluationBoardResponse.Record(entry.kind(), entry.id(), "sent", proposal.decision(),
				proposal.useCaseId(), 0, entry.stamp());
	}

	private static EvaluationBoardResponse.Run run(EvaluationRepository.RunState run) {
		return new EvaluationBoardResponse.Run(run.id(), run.state(), run.origin(), run.modelName(), run.failure(),
				run.assessed(), run.total(), run.createdAt(), run.startedAt(), run.endedAt(), run.notBefore(),
				run.resumeAt());
	}

	/** The names of the organizations no submitted application names, as their organization module has them. */
	private Map<UUID, OrganizationName> names(List<Candidate> candidates) {
		Set<UUID> unnamed = new HashSet<>();
		candidates.stream()
			.filter(candidate -> sent(candidate) == null)
			.forEach(candidate -> unnamed.add(candidate.organizationId()));
		return unnamed.isEmpty() ? Map.of() : organizations.names(unnamed);
	}

	private static String organizationName(Candidate candidate, Map<UUID, OrganizationName> names) {
		ProgramSubmission.Sent sent = sent(candidate);
		if (sent != null) {
			return sent.organization().name();
		}
		OrganizationName name = names.get(candidate.organizationId());
		return name == null ? "" : name.name();
	}

	private static String solutionName(Candidate candidate) {
		ProgramSubmission.Sent sent = sent(candidate);
		if (sent != null) {
			return sent.solution().name();
		}
		return candidate.records()
			.stream()
			.map(Entry::proposal)
			.filter(Objects::nonNull)
			.flatMap(proposal -> proposal.solutions().stream())
			.filter(solution -> solution.id().equals(candidate.solutionId()))
			.map(SentUseCaseProposal.Solution::name)
			.findFirst()
			.orElse("");
	}

	/** What the candidate's submitted application held; null when it has none. */
	private static ProgramSubmission.@Nullable Sent sent(Candidate candidate) {
		return candidate.records()
			.stream()
			.map(Entry::application)
			.filter(Objects::nonNull)
			.map(ProgramSubmission::sent)
			.filter(Objects::nonNull)
			.findFirst()
			.orElse(null);
	}

	private static List<UUID> key(Candidate candidate) {
		return List.of(candidate.organizationId(), candidate.solutionId());
	}

	private static String text(@Nullable Object value) {
		return value == null ? "" : value.toString();
	}

	private static List<String> texts(@Nullable Object value) {
		List<String> texts = new ArrayList<>();
		if (value instanceof List<?> list) {
			list.stream().filter(Objects::nonNull).map(Object::toString).forEach(texts::add);
		}
		return List.copyOf(texts);
	}

}
