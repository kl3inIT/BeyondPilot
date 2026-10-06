package ai.genaifund.beyondpilot.proposal;

import ai.genaifund.beyondpilot.notification.EmailService;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Queues the emails of the review in the transaction of what they tell: a judge's invitation and each applicant's
 * outcome. They leave once it commits, and the email queue retries one the provider cannot take; the operator can
 * also send an invitation again, and an applicant sees their outcome on My applications either way.
 */
@Component
class ReviewMail {

	private final EmailService email;

	ReviewMail(EmailService email) {
		this.email = email;
	}

	@EventListener
	void invite(ReviewerInvited invited) {
		email.sendReviewerInvitation(invited.email(), invited.programName(), invited.inviterName(),
				invited.expiresAt());
	}

	@EventListener
	void outcomes(OutcomesReleased released) {
		for (OutcomesReleased.Outcome outcome : released.outcomes()) {
			email.sendApplicationOutcome(outcome.recipient(), outcome.subject(), outcome.message());
		}
	}
}
