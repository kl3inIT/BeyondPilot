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
import java.util.Objects;
import java.util.Optional;
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
import ai.genaifund.beyondpilot.program.ProgramName;
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
import ai.genaifund.beyondpilot.shared.Spreadsheet;
import ai.genaifund.beyondpilot.shared.SpreadsheetFile;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * How a program's review is set up: the criteria its applications are judged on, and the judges GenAI Fund invites.
 * Operators set both; a judge reads the criteria and the programs they review.
 */
@Service
public class ReviewSetup {

	private static final Logger LOG = LoggerFactory.getLogger(ReviewSetup.class);

	/** How long an invitation nobody used stays open. */
	static final Duration INVITATION = Duration.ofDays(7);

	private static final String PROGRAM = "program";

	/** The highest score of a criterion, which gives all its points. */
	static final int SCALE = 10;

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

	/**
	 * The programs the caller reviews: every program taking applications for an operator, their invitations otherwise.
	 * A judge counts only the shortlisted applications, the ones they read.
	 */
	@Transactional
	public ReviewProgramsResponse programs(Actor actor) {
		Person person = identity.person(actor);
		boolean operator = identity.isOperator(actor);
		List<UUID> ids = operator ? proposals.findProgramsWithSubmissions() : access.programsOf(person);
		Map<UUID, ApplicationForm> forms = programs.formsUnderReview(ids);
		List<ReviewProgramResponse> items = new ArrayList<>();
		for (UUID id : ids) {
			ApplicationForm form = forms.get(id);
			if (form == null) {
				continue;
			}
			List<UUID> submitted = readable(id, operator);
			long assessed = assessments.findByProposalIdIn(submitted)
				.stream()
				.filter(assessment -> assessment.getAccountId().equals(person.accountId()))
				.filter(assessment -> assessment.isScored() || assessment.isConflict())
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
		return criteriaFor(programId, access.of(actor, programId).operator());
	}

	/**
	 * Replaces a program's criteria, in order. They are fixed once an application of the program has been scored.
	 * @throws ProposalException when the program takes no applications, an application was scored, two criteria
	 * share a name, or some criteria have points and others not
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
		long worth = request.criteria().stream().filter(criterion -> criterion.maxPoints() != null).count();
		if (worth != 0 && worth != request.criteria().size()) {
			throw new ProposalException(ProposalErrorCode.CRITERIA_POINTS_INVALID,
					"Criteria of program " + programId + " with points that do not hold together");
		}
		criteria.deleteByProgramId(programId);
		int position = 0;
		for (SaveCriteriaRequest.Criterion criterion : request.criteria()) {
			criteria.save(new ReviewCriterion(UUID.randomUUID(), programId, position++, criterion.name().strip(),
					text(criterion.description()), criterion.maxPoints()));
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
		List<UUID> submitted = readable(programId, true);
		Map<UUID, Long> assessed = new HashMap<>();
		Map<UUID, Long> conflicts = new HashMap<>();
		for (ProposalAssessment assessment : assessments.findByProposalIdIn(submitted)) {
			// A note or a bookmark alone is not a score; a conflict is a judge's answer, though not a score.
			if (assessment.isScored() || assessment.isConflict()) {
				assessed.merge(assessment.getAccountId(), 1L, Long::sum);
			}
			if (assessment.isConflict()) {
				conflicts.merge(assessment.getAccountId(), 1L, Long::sum);
			}
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
					reviewer.getExpiresAt(), accountId == null ? 0 : assessed.getOrDefault(accountId, 0L),
					accountId == null ? 0 : conflicts.getOrDefault(accountId, 0L)));
		}
		for (Map.Entry<UUID, Long> entry : assessed.entrySet()) {
			Person person = people.get(entry.getKey());
			if (!judges.contains(entry.getKey()) && person != null) {
				items.add(0, new ReviewerResponse(null, person.email(), person.displayName(), "operator", "active",
						null, null, entry.getValue(), conflicts.getOrDefault(entry.getKey(), 0L)));
			}
		}
		return new ReviewersResponse(items, submitted.size());
	}

	/**
	 * Who scores a program's applications as a spreadsheet, the operators who scored first and then the judges in the
	 * order they were invited, for GenAI Fund to follow the review outside BeyondPilot. It holds addresses, so the
	 * download is recorded on the program.
	 * @throws ProposalException when the program takes no applications
	 */
	@Transactional
	public SpreadsheetFile exportReviewers(Actor actor, UUID programId, SpreadsheetFormat format) {
		Operator operator = access.operator(actor);
		ApplicationForm form = form(programId);
		ReviewersResponse list = reviewers(actor, programId);
		Spreadsheet<ReviewerResponse> sheet = Spreadsheet.<ReviewerResponse>of("Reviewers")
			.text("Name", ReviewerResponse::name)
			.email("Email", ReviewerResponse::email)
			.label("Role", ReviewerResponse::role)
			.label("Status", ReviewerResponse::status)
			.time("Invited at", ReviewerResponse::invitedAt)
			.time("Invitation expires at", ReviewerResponse::expiresAt)
			.count("Applications done", ReviewerResponse::assessed)
			.count("Of which conflicts", ReviewerResponse::conflicts);
		SpreadsheetFile file = sheet.write(format, form.slug() + "-reviewers", list.items(),
				Spreadsheet.About.of(operator.label(), Instant.now())
					.narrowedBy("Applications to score", String.valueOf(list.applications())));
		record(AuditAction.PROPOSAL_REVIEWERS_EXPORT, operator, form, Map.of("count", String.valueOf(file.rows())));
		LOG.atInfo()
			.addKeyValue("event", "proposal.reviewers.exported")
			.addKeyValue("program_id", programId)
			.addKeyValue("format", format.extension())
			.addKeyValue("count", file.rows())
			.log("Reviewers exported");
		return file;
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

	/** The accounts of a program's judges who joined and were not removed, in the order they were invited. */
	List<UUID> joinedJudges(UUID programId) {
		return reviewers.findByProgramIdAndRemovedAtIsNullOrderByInvitedAt(programId)
			.stream()
			.map(ProposalReviewer::getAccountId)
			.filter(Objects::nonNull)
			.toList();
	}

	/** The accounts of the judges invited to a program who signed in, removed or not, for naming their role. */
	List<UUID> judgesOf(UUID programId) {
		return reviewers.findJudgeAccounts(programId);
	}

	/**
	 * The identifiers of a program's submitted applications the caller reads, the earliest first: every one for an
	 * operator, the shortlisted for a judge.
	 */
	List<UUID> readable(UUID programId, boolean operator) {
		return proposals.findByProgramIdAndStatusOrderBySubmittedAt(programId, Proposal.SUBMITTED)
			.stream()
			.filter(proposal -> operator || proposal.isShortlisted())
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

	/** The name of a program, drafts included; empty when there is no such program. */
	Optional<String> programName(UUID programId) {
		return Optional.ofNullable(programs.names(List.of(programId)).get(programId)).map(ProgramName::name);
	}

	/** The criteria as the caller reads them: a judge rates quality and never reads the weights. */
	CriteriaResponse criteriaFor(UUID programId, boolean operator) {
		CriteriaResponse all = criteriaOf(programId);
		return operator ? all : new CriteriaResponse(all.criteria()
			.stream()
			.map(criterion -> new CriterionResponse(criterion.id(), criterion.name(), criterion.description(), null))
			.toList(), all.fixed());
	}

	CriteriaResponse criteriaOf(UUID programId) {
		return new CriteriaResponse(criteria.findByProgramIdOrderByPosition(programId)
			.stream()
			.map(criterion -> new CriterionResponse(criterion.getId(), criterion.getName(), criterion.getDescription(),
					criterion.getMaxPoints()))
			.toList(), assessments.existsForProgram(programId));
	}

	void record(AuditAction action, Operator operator, ApplicationForm form, Map<String, String> details) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(PROGRAM, form.programId().toString(), form.name()), details));
	}

	private void sent(Operator operator, ApplicationForm form, ProposalReviewer reviewer) {
		record(AuditAction.PROPOSAL_REVIEWER_INVITE, operator, form, Map.of("email", reviewer.getEmail()));
		events.publishEvent(new ReviewerInvited(reviewer.getId(), reviewer.getEmail(), form.programId(), form.name(),
				operator.label(), reviewer.getExpiresAt()));
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
