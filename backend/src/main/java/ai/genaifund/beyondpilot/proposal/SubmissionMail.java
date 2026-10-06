package ai.genaifund.beyondpilot.proposal;

import ai.genaifund.beyondpilot.notification.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Sends the applicant a copy once the submission has committed. A mail that fails leaves the application submitted;
 * My applications shows it either way.
 */
@Component
class SubmissionMail {

	private static final Logger LOG = LoggerFactory.getLogger(SubmissionMail.class);

	private final EmailService email;

	SubmissionMail(EmailService email) {
		this.email = email;
	}

	@TransactionalEventListener
	void send(ProposalSubmitted submitted) {
		try {
			email.sendApplicationReceived(submitted.recipient(), submitted.programName(), submitted.version(),
					submitted.editableUntil());
		}
		catch (RuntimeException failure) {
			LOG.atWarn()
				.addKeyValue("event", "proposal.confirmation.failed")
				.addKeyValue("proposal_id", submitted.proposalId())
				.addKeyValue("error_type", failure.getClass().getName())
				.log("The confirmation of a submitted application could not be sent");
		}
	}
}
