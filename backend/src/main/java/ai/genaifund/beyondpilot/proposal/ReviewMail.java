package ai.genaifund.beyondpilot.proposal;

import ai.genaifund.beyondpilot.notification.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Sends the emails of the review once what they tell has committed: a judge's invitation and each applicant's
 * outcome. A mail that fails leaves what it told in place: the operator can send an invitation again, and an applicant
 * sees their outcome on My applications either way.
 */
@Component
class ReviewMail {

	private static final Logger LOG = LoggerFactory.getLogger(ReviewMail.class);

	private final EmailService email;

	ReviewMail(EmailService email) {
		this.email = email;
	}

	@TransactionalEventListener
	void invite(ReviewerInvited invited) {
		try {
			email.sendReviewerInvitation(invited.email(), invited.programName(), invited.inviterName(),
					invited.expiresAt());
		}
		catch (RuntimeException failure) {
			LOG.atWarn()
				.addKeyValue("event", "proposal.reviewer_invitation.failed")
				.addKeyValue("reviewer_id", invited.reviewerId())
				.addKeyValue("error_type", failure.getClass().getName())
				.log("The invitation of a judge could not be sent");
		}
	}

	@TransactionalEventListener
	void outcomes(OutcomesReleased released) {
		for (OutcomesReleased.Outcome outcome : released.outcomes()) {
			try {
				email.sendApplicationOutcome(outcome.recipient(), outcome.subject(), outcome.message());
			}
			catch (RuntimeException failure) {
				LOG.atWarn()
					.addKeyValue("event", "proposal.outcome_email.failed")
					.addKeyValue("proposal_id", outcome.proposalId())
					.addKeyValue("error_type", failure.getClass().getName())
					.log("The outcome of an application could not be sent");
			}
		}
	}
}
