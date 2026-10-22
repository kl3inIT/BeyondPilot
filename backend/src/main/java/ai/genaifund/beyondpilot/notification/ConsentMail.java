package ai.genaifund.beyondpilot.notification;

import java.util.List;

import ai.genaifund.beyondpilot.identity.ConsentChanged;
import ai.genaifund.beyondpilot.identity.ConsentPurpose;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Confirms by email a withdrawal of the consent to use the platform, once it is recorded: a failure here never undoes
 * the withdrawal. Other choices take effect at once and the screen says so; this one locks the account, so the person
 * keeps a record of it. The choice is read again, so a person who has agreed again by the time this runs is not
 * emailed.
 */
@Component
class ConsentMail {

	private final EmailService emails;

	private final IdentityService identity;

	ConsentMail(EmailService emails, IdentityService identity) {
		this.emails = emails;
		this.identity = identity;
	}

	@ApplicationModuleListener
	void on(ConsentChanged changed) {
		if (changed.purpose() != ConsentPurpose.PLATFORM || !changed.withdrawal()
				|| !identity.declined(changed.accountId(), ConsentPurpose.PLATFORM)) {
			return;
		}
		Person person = identity.people(List.of(changed.accountId())).get(changed.accountId());
		if (person != null) {
			emails.sendConsentWithdrawn(person.email());
		}
	}
}
