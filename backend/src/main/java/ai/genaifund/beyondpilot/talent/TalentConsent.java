package ai.genaifund.beyondpilot.talent;

import ai.genaifund.beyondpilot.identity.ConsentChanged;
import ai.genaifund.beyondpilot.identity.ConsentPurpose;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfileRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * A person's choice about AI changes how their profile is indexed (BEY-240), so the profile is announced as changed and
 * search reads it again. A repeated delivery announces it again, which writes the same.
 */
@Component
class TalentConsent {

	private final TalentProfileRepository profiles;

	private final ApplicationEventPublisher events;

	TalentConsent(TalentProfileRepository profiles, ApplicationEventPublisher events) {
		this.profiles = profiles;
		this.events = events;
	}

	@ApplicationModuleListener
	void on(ConsentChanged changed) {
		if (changed.purpose() != ConsentPurpose.AI) {
			return;
		}
		profiles.findByAccountId(changed.accountId())
			.ifPresent(profile -> events.publishEvent(new TalentProfileChanged(profile.getId())));
	}
}
