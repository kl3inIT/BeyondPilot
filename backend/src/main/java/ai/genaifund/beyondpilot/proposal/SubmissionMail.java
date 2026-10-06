package ai.genaifund.beyondpilot.proposal;

import ai.genaifund.beyondpilot.notification.EmailService;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Queues the applicant's copy in the transaction of the submission, so it leaves once the submission commits and never
 * for one that rolled back. A copy the provider cannot take is retried by the email queue; My applications shows the
 * submission either way.
 */
@Component
class SubmissionMail {

	private final EmailService email;

	SubmissionMail(EmailService email) {
		this.email = email;
	}

	@EventListener
	void send(ProposalSubmitted submitted) {
		email.sendApplicationReceived(submitted.recipient(), submitted.programName(), submitted.version(),
				submitted.editableUntil());
	}
}
