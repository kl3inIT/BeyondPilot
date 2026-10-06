package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.program.ApplicationForm;
import ai.genaifund.beyondpilot.proposal.ReviewAccess.Reviewing;
import ai.genaifund.beyondpilot.proposal.dto.DecideRequest;
import ai.genaifund.beyondpilot.proposal.dto.ReleaseEmails;
import ai.genaifund.beyondpilot.proposal.dto.ReleaseResponse;
import ai.genaifund.beyondpilot.proposal.dto.ReviewApplicationsResponse;
import ai.genaifund.beyondpilot.proposal.persistence.Proposal;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalAssessment;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalAssessmentRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalRelease;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalReleaseRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalRepository;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalReviewDecision;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalReviewDecisionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * GenAI Fund's decisions on a program's applications and the release of the outcomes. A decision stays internal and
 * can change until the release; the release tells every applicant at once, after the close, and is final.
 */
@Service
public class OutcomeService {

	private static final Logger LOG = LoggerFactory.getLogger(OutcomeService.class);

	private final ReviewSetup setup;

	private final ReviewService review;

	private final ReviewAccess access;

	private final ProposalRepository proposals;

	private final ProposalAssessmentRepository assessments;

	private final ProposalReviewDecisionRepository decisions;

	private final ProposalReleaseRepository releases;

	private final IdentityService identity;

	private final ApplicationEventPublisher events;

	OutcomeService(ReviewSetup setup, ReviewService review, ReviewAccess access, ProposalRepository proposals,
			ProposalAssessmentRepository assessments, ProposalReviewDecisionRepository decisions,
			ProposalReleaseRepository releases, IdentityService identity, ApplicationEventPublisher events) {
		this.setup = setup;
		this.review = review;
		this.access = access;
		this.proposals = proposals;
		this.assessments = assessments;
		this.decisions = decisions;
		this.releases = releases;
		this.identity = identity;
		this.events = events;
	}

	/**
	 * Decides on one application or several of a program, keeping each change with its private reason.
	 * @throws ProposalException when the program takes no applications, an application is not one of its submitted
	 * ones, or its outcomes were released
	 */
	@Transactional
	public ReviewApplicationsResponse decide(Actor actor, UUID programId, DecideRequest request) {
		Operator operator = access.operator(actor);
		ApplicationForm form = setup.form(programId);
		review.requireNotReleased(form);
		Instant now = Instant.now();
		String reason = request.reason() == null || request.reason().isBlank() ? null : request.reason().strip();
		for (UUID id : new HashSet<>(request.applicationIds())) {
			Proposal proposal = review.submitted(id);
			if (!proposal.getProgramId().equals(programId)) {
				throw new ProposalException(ProposalErrorCode.APPLICATION_NOT_FOUND,
						"Application " + id + " is not of program " + programId);
			}
			if (proposal.getReviewStatus().equals(request.decision())) {
				continue;
			}
			decisions.save(new ProposalReviewDecision(UUID.randomUUID(), id, operator.accountId(),
					proposal.getReviewStatus(), request.decision(), reason, now));
			proposals.decide(id, request.decision());
			setup.record(AuditAction.PROPOSAL_DECIDE, operator, form, Map.of("decision", request.decision()));
		}
		decisions.flush();
		LOG.atInfo()
			.addKeyValue("event", "proposal.decision.recorded")
			.addKeyValue("program_id", programId)
			.addKeyValue("decision", request.decision())
			.addKeyValue("count", request.applicationIds().size())
			.log("Decision recorded");
		return review.applications(actor, programId);
	}

	/**
	 * Who would hear what if the outcomes were released now, and whether they can be.
	 * @throws ProposalException when the program takes no applications
	 */
	@Transactional
	public ReleaseResponse release(Actor actor, UUID programId) {
		access.operator(actor);
		ApplicationForm form = setup.form(programId);
		return preview(form, access.of(actor, programId));
	}

	/**
	 * Releases the outcomes of a program: each applicant gets their group's email once this has committed, and sees
	 * their outcome on BeyondPilot. It happens once.
	 * @throws ProposalException when the program takes no applications, its applications have not closed, an
	 * application has no decision, or the outcomes were released already
	 */
	@Transactional
	public ReleaseResponse release(Actor actor, UUID programId, ReleaseEmails emails) {
		Operator operator = access.operator(actor);
		ApplicationForm form = setup.form(programId);
		review.requireNotReleased(form);
		List<Proposal> submitted = proposals.findByProgramIdAndStatusOrderBySubmittedAt(programId, Proposal.SUBMITTED);
		if (Instant.now().isBefore(form.closesAt())
				|| submitted.stream().anyMatch(proposal -> Proposal.UNDER_REVIEW.equals(proposal.getReviewStatus()))) {
			throw new ProposalException(ProposalErrorCode.OUTCOMES_NOT_READY,
					"Release of program " + programId + " before its close or with an application undecided");
		}
		Instant now = Instant.now();
		releases.saveAndFlush(new ProposalRelease(programId, now, operator.accountId(), emails.shortlistedSubject().strip(),
				emails.shortlistedMessage().strip(), emails.notSelectedSubject().strip(),
				emails.notSelectedMessage().strip()));
		Map<UUID, Person> applicants = identity.people(submitted.stream().map(Proposal::getAccountId).toList());
		List<OutcomesReleased.Outcome> outcomes = new ArrayList<>();
		int shortlisted = 0;
		for (Proposal proposal : submitted) {
			Person applicant = applicants.get(proposal.getAccountId());
			if (applicant == null) {
				continue;
			}
			boolean chosen = Proposal.SHORTLISTED.equals(proposal.getReviewStatus());
			shortlisted += chosen ? 1 : 0;
			ReviewService.Snapshot snapshot = review.snapshot(proposal);
			outcomes.add(new OutcomesReleased.Outcome(proposal.getId(), proposal.getReviewStatus(), applicant.email(),
					fill(chosen ? emails.shortlistedSubject() : emails.notSelectedSubject(), snapshot),
					fill(chosen ? emails.shortlistedMessage() : emails.notSelectedMessage(), snapshot)));
		}
		setup.record(AuditAction.PROPOSAL_RELEASE, operator, form, Map.of("shortlisted", String.valueOf(shortlisted),
				"not_selected", String.valueOf(outcomes.size() - shortlisted)));
		events.publishEvent(new OutcomesReleased(programId, outcomes));
		LOG.atInfo()
			.addKeyValue("event", "proposal.outcomes.released")
			.addKeyValue("program_id", programId)
			.addKeyValue("applicants", outcomes.size())
			.log("Outcomes released");
		return preview(form, access.of(actor, programId));
	}

	private ReleaseResponse preview(ApplicationForm form, Reviewing reviewing) {
		List<Proposal> submitted = proposals.findByProgramIdAndStatusOrderBySubmittedAt(form.programId(),
				Proposal.SUBMITTED);
		Map<UUID, List<ProposalAssessment>> byProposal = new HashMap<>();
		for (ProposalAssessment assessment : assessments
			.findByProposalIdIn(submitted.stream().map(Proposal::getId).toList())) {
			byProposal.computeIfAbsent(assessment.getProposalId(), id -> new ArrayList<>()).add(assessment);
		}
		List<ReleaseResponse.Item> shortlisted = new ArrayList<>();
		List<ReleaseResponse.Item> notSelected = new ArrayList<>();
		List<ReleaseResponse.Item> undecided = new ArrayList<>();
		for (Proposal proposal : submitted) {
			ReviewService.Snapshot snapshot = review.snapshot(proposal);
			ReleaseResponse.Item item = new ReleaseResponse.Item(proposal.getId(), snapshot.solution().name(),
					snapshot.organization().name(), snapshot.organization().type(), snapshot.organization().country(),
					review.average(byProposal.getOrDefault(proposal.getId(), List.of())));
			switch (proposal.getReviewStatus()) {
				case Proposal.SHORTLISTED -> shortlisted.add(item);
				case Proposal.NOT_SELECTED -> notSelected.add(item);
				default -> undecided.add(item);
			}
		}
		ProposalRelease released = releases.findById(form.programId()).orElse(null);
		boolean ready = released == null && !Instant.now().isBefore(form.closesAt()) && undecided.isEmpty()
				&& !submitted.isEmpty();
		return new ReleaseResponse(review.head(form, reviewing), ready, shortlisted, notSelected, undecided,
				proposals.countByProgramIdAndStatus(form.programId(), Proposal.WITHDRAWN),
				released == null ? starting(form) : new ReleaseEmails(released.getShortlistedSubject(),
						released.getShortlistedMessage(), released.getNotSelectedSubject(),
						released.getNotSelectedMessage()));
	}

	/** The emails an operator starts from, in the words of the program. */
	private static ReleaseEmails starting(ApplicationForm form) {
		return new ReleaseEmails("You're shortlisted for " + form.name(),
				"Hi {organization},\n\n{solution} is one of the teams shortlisted for " + form.name()
						+ ". We will be in touch about what comes next.\n\nYour application stays on BeyondPilot under My applications.\n\nGenAI Fund",
				"Your application to " + form.name(),
				"Hi {organization},\n\nThank you for applying with {solution}. It was not selected this time.\n\nYour application stays on BeyondPilot under My applications, and we hope to see you in the next program.\n\nGenAI Fund");
	}

	private static String fill(String text, ReviewService.Snapshot snapshot) {
		return text.replace("{organization}", snapshot.organization().name())
			.replace("{solution}", snapshot.solution().name());
	}
}
