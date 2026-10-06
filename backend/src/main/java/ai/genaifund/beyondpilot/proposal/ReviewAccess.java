package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.proposal.persistence.Proposal;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalReviewer;
import ai.genaifund.beyondpilot.proposal.persistence.ProposalReviewerRepository;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Who may review a program: every operator, and the person who signs in with an address GenAI Fund invited to it. The
 * first time an invited person opens the review, the invitation becomes theirs.
 */
@Component
class ReviewAccess {

	private static final Logger LOG = LoggerFactory.getLogger(ReviewAccess.class);

	private final IdentityService identity;

	private final ProposalReviewerRepository reviewers;

	private final OrganizationDirectory organizations;

	ReviewAccess(IdentityService identity, ProposalReviewerRepository reviewers, OrganizationDirectory organizations) {
		this.identity = identity;
		this.reviewers = reviewers;
		this.organizations = organizations;
	}

	/**
	 * The caller as a reviewer of the program. Runs inside the caller's transaction, which keeps their joining.
	 * @throws ProposalException when the caller is neither an operator nor an invited judge of the program now
	 */
	Reviewing of(Actor actor, UUID programId) {
		Person person = identity.person(actor);
		@Nullable UUID organizationId = organizations.membershipOf(actor).map(Membership::organizationId).orElse(null);
		if (identity.isOperator(actor)) {
			return new Reviewing(person, true, organizationId);
		}
		ProposalReviewer reviewer = reviewers.findOpen(programId, person.email())
			.filter(found -> found.isActiveAt(Instant.now()))
			.orElseThrow(() -> new ProposalException(ProposalErrorCode.REVIEW_NOT_ALLOWED,
					"Account " + actor.accountId() + " does not review program " + programId));
		join(reviewer, person);
		return new Reviewing(person, false, organizationId);
	}

	/** The programs an invited judge reviews now; an operator reviews every program and needs none. */
	List<UUID> programsOf(Person person) {
		Instant now = Instant.now();
		List<UUID> programs = new ArrayList<>();
		for (ProposalReviewer reviewer : reviewers.findOpenFor(person.email())) {
			if (reviewer.isActiveAt(now)) {
				join(reviewer, person);
				programs.add(reviewer.getProgramId());
			}
		}
		return programs;
	}

	/**
	 * The caller as an operator.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator now
	 */
	Operator operator(Actor actor) {
		return identity.requireOperator(actor);
	}

	private static void join(ProposalReviewer reviewer, Person person) {
		if (!reviewer.hasJoined()) {
			reviewer.join(person.accountId(), Instant.now());
			LOG.atInfo()
				.addKeyValue("event", "proposal.reviewer.joined")
				.addKeyValue("program_id", reviewer.getProgramId())
				.log("An invited judge opened the review");
		}
	}

	/**
	 * Someone reviewing a program.
	 * @param operator whether they are GenAI Fund staff, who read every score and decide
	 * @param organizationId the organization they belong to, whose applications they never score or decide
	 */
	record Reviewing(Person person, boolean operator, @Nullable UUID organizationId) {

		UUID accountId() {
			return person.accountId();
		}

		/** Whether the application is theirs, or their organization's. */
		boolean owns(Proposal proposal) {
			return proposal.getAccountId().equals(person.accountId())
					|| (organizationId != null && organizationId.equals(proposal.getOrganizationId()));
		}
	}
}
