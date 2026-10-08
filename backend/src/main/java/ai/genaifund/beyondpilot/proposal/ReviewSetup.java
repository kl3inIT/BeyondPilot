package ai.genaifund.beyondpilot.proposal;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.program.ApplicationForm;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.proposal.dto.CriteriaResponse;
import ai.genaifund.beyondpilot.proposal.dto.CriterionResponse;
import ai.genaifund.beyondpilot.proposal.dto.InviteReviewerRequest;
import ai.genaifund.beyondpilot.proposal.dto.ReviewProgramResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewProgramsResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewerResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewersResponse;
import ai.genaifund.beyondpilot.proposal.dto.SaveCriteriaRequest;
import ai.genaifund.beyondpilot.proposal.persistence.Proposal;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalAssessment;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalAssessmentRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalReleaseRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalReviewer;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalReviewerRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ReviewCriterion;
import ai.genaifund.beyondpilot.proposal.persistence.ReviewCriterionRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * How a program's review is set up: the criteria its applications are judged on, and the judges GenAI Fund invites.
 * Operators set both; a judge reads the criteria and the programs they review.
 */
@Service
public class ReviewSetup {

	/** How long an invitation nobody used stays open. */
	static final Duration INVITATION = Duration.ofDays(7);

	private static final String PROGRAM = "program";

	private final ReviewAccess access;

	private final ProgramService programs;

	private final ReviewCriterionRepository criteria;

	private final ProposalReviewerRepository reviewers;

	private final ProposalRepository proposals;

	private final ProposalAssessmentRepository assessments;

	private final ProposalReleaseRepository releases;

	private final IdentityService identity;

	private final AuditTrail audit;

	private final ApplicationEventPublisher events;

	ReviewSetup(ReviewAccess access, ProgramService programs, ReviewCriterionRepository criteria,
			ProposalReviewerRepository reviewers, ProposalRepository proposals, ProposalAssessmentRepository assessments,
			ProposalReleaseRepository releases, IdentityService identity, AuditTrail audit,
			ApplicationEventPublisher events) {
		this.access = access;
		this.programs = programs;
		this.criteria = criteria;
		this.reviewers = reviewers;
		this.proposals = proposals;
		this.assessments = assessments;
		this.releases = releases;
		this.identity = identity;
		this.audit = audit;
		this.events = events;
	}

	/** The programs the caller reviews: every program taking applications for an operator, their invitations otherwise. */
	@Transactional
	public ReviewProgramsResponse programs(Actor actor) {
		Person person = identity.person(actor);
		List<UUID> ids = identity.isOperator(actor) ? proposals.findProgramsWithSubmissions()
				: access.programsOf(person);
		Map<UUID, ApplicationForm> forms = programs.formsUnderReview(ids);
		List<ReviewProgramResponse> items = new ArrayList<>();
		for (UUID id : ids) {
			ApplicationForm form = forms.get(id);
			if (form == null) {
				continue;
			}
			List<UUID> submitted = submitted(id);
			long assessed = assessments.findByProposalIdIn(submitted)
				.stream()
				.filter(assessment -> assessment.getAccountId().equals(person.accountId()))
				.count();
			items.add(new ReviewProgramResponse(id, form.slug(), form.name(), form.closesAt(), form.outcomesDueOn(),
					releases.existsById(id), submitted.size(), assessed));
		}
		return new ReviewProgramsResponse(items);
	}

	/**
	 * The criteria a program's applications are judged on.
	 * @throws ProposalException when the program takes no applications, or the caller does not review it
	 */
	@Transactional
	public CriteriaResponse criteria(Actor actor, UUID programId) {
		form(programId);
		access.of(actor, programId);
		return criteriaOf(programId);
	}

	/**
	 * Replaces a program's criteria, in order. They are fixed once an application of the program has been scored.
	 * @throws ProposalException when the program takes no applications, an application was scored, or two criteria
	 * share a name
	 */
	@Transactional
	public CriteriaResponse saveCriteria(Actor actor, UUID programId, SaveCriteriaRequest request) {
		Operator operator = access.operator(actor);
		ApplicationForm form = form(programId);
		if (assessments.existsForProgram(programId)) {
			throw new ProposalException(ProposalErrorCode.CRITERIA_FIXED,
					"Criteria of program " + programId + " after a score was saved");
		}
		Set<String> names = new HashSet<>();
		for (SaveCriteriaRequest.Criterion criterion : request.criteria()) {
			if (!names.add(criterion.name().strip().toLowerCase(Locale.ROOT))) {
				throw new ProposalException(ProposalErrorCode.CRITERIA_INVALID,
						"Two criteria of program " + programId + " share a name");
			}
		}
		criteria.deleteByProgramId(programId);
		int position = 0;
		for (SaveCriteriaRequest.Criterion criterion : request.criteria()) {
			criteria.save(new ReviewCriterion(UUID.randomUUID(), programId, position++, criterion.name().strip(),
					text(criterion.description())));
		}
		criteria.flush();
		record(AuditAction.PROPOSAL_CRITERIA_UPDATE, operator, form,
				Map.of("count", String.valueOf(request.criteria().size())));
		return criteriaOf(programId);
	}

	/**
	 * The judges of a program and the operators who scored its applications, each with how many they scored.
	 * @throws ProposalException when the program takes no applications
	 */
	@Transactional(readOnly = true)
	public ReviewersResponse reviewers(Actor actor, UUID programId) {
		access.operator(actor);
		form(programId);
		List<UUID> submitted = submitted(programId);
		Map<UUID, Long> assessed = new HashMap<>();
		for (ProposalAssessment assessment : assessments.findByProposalIdIn(submitted)) {
			assessed.merge(assessment.getAccountId(), 1L, Long::sum);
		}
		List<ProposalReviewer> invited = reviewers.findByProgramIdAndRemovedAtIsNullOrderByInvitedAt(programId);
		Set<UUID> accounts = new LinkedHashSet<>(assessed.keySet());
		invited.stream().map(ProposalReviewer::getAccountId).filter(id -> id != null).forEach(accounts::add);
		Map<UUID, Person> people = identity.people(accounts);
		Instant now = Instant.now();
		List<ReviewerResponse> items = new ArrayList<>();
		Set<UUID> judges = new HashSet<>();
		for (ProposalReviewer reviewer : invited) {
			UUID accountId = reviewer.getAccountId();
			Person person = accountId == null ? null : people.get(accountId);
			if (accountId != null) {
				judges.add(accountId);
			}
			String status = reviewer.hasJoined() ? "active" : reviewer.isActiveAt(now) ? "invited" : "lapsed";
			items.add(new ReviewerResponse(reviewer.getId(), reviewer.getEmail(),
					person == null ? null : person.displayName(), "reviewer", status, reviewer.getInvitedAt(),
					reviewer.getExpiresAt(), accountId == null ? 0 : assessed.getOrDefault(accountId, 0L)));
		}
		for (Map.Entry<UUID, Long> entry : assessed.entrySet()) {
			Person person = people.get(entry.getKey());
			if (!judges.contains(entry.getKey()) && person != null) {
				items.add(0, new ReviewerResponse(null, person.email(), person.displayName(), "operator", "active",
						null, null, entry.getValue()));
			}
		}
		return new ReviewersResponse(items, submitted.size());
	}

	/**
	 * Invites an address to judge a program. The person signs in with it and finds the program under Reviews.
	 * @throws ProposalException when the program takes no applications or the address is already invited to it
	 */
	@Transactional
	public ReviewersResponse invite(Actor actor, UUID programId, InviteReviewerRequest request) {
		Operator operator = access.operator(actor);
		ApplicationForm form = form(programId);
		String email = request.email().strip();
		if (reviewers.findOpen(programId, email).isPresent()) {
			throw new ProposalException(ProposalErrorCode.REVIEWER_INVITED,
					"An address already invited to program " + programId);
		}
		Instant now = Instant.now();
		ProposalReviewer reviewer = reviewers.saveAndFlush(
				new ProposalReviewer(UUID.randomUUID(), programId, email, operator.accountId(), now, now.plus(INVITATION)));
		sent(operator, form, reviewer);
		return reviewers(actor, programId);
	}

	/**
	 * Sends an invitation nobody used again, open for another period.
	 * @throws ProposalException when the program has no such judge, or they already signed in
	 */
	@Transactional
	public ReviewersResponse resend(Actor actor, UUID programId, UUID reviewerId) {
		Operator operator = access.operator(actor);
		ApplicationForm form = form(programId);
		ProposalReviewer reviewer = reviewer(programId, reviewerId);
		if (reviewer.hasJoined()) {
			throw new ProposalException(ProposalErrorCode.REVIEWER_JOINED,
					"Invitation " + reviewerId + " was used already");
		}
		Instant now = Instant.now();
		reviewer.renew(now, now.plus(INVITATION));
		reviewers.flush();
		sent(operator, form, reviewer);
		return reviewers(actor, programId);
	}

	/**
	 * Takes a judge off a program. They no longer see it; the scores they gave stay.
	 * @throws ProposalException when the program has no such judge
	 */
	@Transactional
	public ReviewersResponse remove(Actor actor, UUID programId, UUID reviewerId) {
		Operator operator = access.operator(actor);
		ApplicationForm form = form(programId);
		ProposalReviewer reviewer = reviewer(programId, reviewerId);
		reviewer.remove(Instant.now());
		reviewers.flush();
		record(AuditAction.PROPOSAL_REVIEWER_REMOVE, operator, form, Map.of("email", reviewer.getEmail()));
		return reviewers(actor, programId);
	}

	/** The accounts of the judges invited to a program who signed in, removed or not, for naming their role. */
	List<UUID> judgesOf(UUID programId) {
		return reviewers.findJudgeAccounts(programId);
	}

	/** The identifiers of a program's submitted applications. */
	List<UUID> submitted(UUID programId) {
		return proposals.findByProgramIdAndStatusOrderBySubmittedAt(programId, Proposal.SUBMITTED)
			.stream()
			.map(Proposal::getId)
			.toList();
	}

	/**
	 * A program's application form, whatever its status.
	 * @throws ProposalException when there is no such program taking applications
	 */
	ApplicationForm form(UUID programId) {
		ApplicationForm form = programs.formsUnderReview(List.of(programId)).get(programId);
		if (form == null) {
			throw new ProposalException(ProposalErrorCode.REVIEW_PROGRAM_NOT_FOUND,
					"No program " + programId + " taking applications");
		}
		return form;
	}

	CriteriaResponse criteriaOf(UUID programId) {
		return new CriteriaResponse(criteria.findByProgramIdOrderByPosition(programId)
			.stream()
			.map(criterion -> new CriterionResponse(criterion.getId(), criterion.getName(), criterion.getDescription()))
			.toList(), assessments.existsForProgram(programId));
	}

	void record(AuditAction action, Operator operator, ApplicationForm form, Map<String, String> details) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(PROGRAM, form.programId().toString(), form.name()), details));
	}

	/** Records that a reviewer, an operator or a judge, opened a file of an application of the program. */
	void opened(Person reviewer, ApplicationForm form, UUID applicationId, UUID fileId) {
		audit.record(new AuditRecord(AuditAction.PROPOSAL_FILE_OPEN,
				new AuditRecord.Actor(reviewer.accountId(), reviewer.label(), reviewer.email()),
				new AuditRecord.Resource(PROGRAM, form.programId().toString(), form.name()),
				Map.of("application", applicationId.toString(), "file", fileId.toString())));
	}

	private void sent(Operator operator, ApplicationForm form, ProposalReviewer reviewer) {
		record(AuditAction.PROPOSAL_REVIEWER_INVITE, operator, form, Map.of("email", reviewer.getEmail()));
		events.publishEvent(new ReviewerInvited(reviewer.getId(), reviewer.getEmail(), form.name(), operator.label(),
				reviewer.getExpiresAt()));
	}

	private ProposalReviewer reviewer(UUID programId, UUID reviewerId) {
		return reviewers.findById(reviewerId)
			.filter(found -> found.getProgramId().equals(programId) && found.isOpen())
			.orElseThrow(() -> new ProposalException(ProposalErrorCode.REVIEWER_NOT_FOUND,
					"No judge " + reviewerId + " of program " + programId));
	}

	private static @Nullable String text(@Nullable String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}
}
