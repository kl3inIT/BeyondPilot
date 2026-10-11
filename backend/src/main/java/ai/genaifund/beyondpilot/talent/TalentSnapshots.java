package ai.genaifund.beyondpilot.talent;

import java.util.Optional;
import java.util.UUID;

import ai.genaifund.beyondpilot.talent.persistence.TalentDetailRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfile;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A person's own talent profile as another module keeps a copy of it. A profile the person has not reviewed with
 * GenAI Fund is read too: a person who sends a proposal need not have had it approved.
 */
@Service
public class TalentSnapshots {

	private final TalentProfileRepository profiles;

	private final TalentDetailRepository details;

	TalentSnapshots(TalentProfileRepository profiles, TalentDetailRepository details) {
		this.profiles = profiles;
		this.details = details;
	}

	/** The profile of the account as it is now; empty when the person has none. */
	@Transactional(readOnly = true)
	public Optional<TalentSnapshot> of(UUID accountId) {
		return profiles.findByAccountId(accountId).map(this::snapshot);
	}

	private TalentSnapshot snapshot(TalentProfile profile) {
		return new TalentSnapshot(profile.getName(), profile.getHeadline(), profile.getBio(), profile.getRoles(),
				profile.getSkills(), profile.getCountry(), profile.getCity(), profile.getWorksAt(),
				profile.getLanguages(), profile.getIndustries(), profile.getEngagement(), profile.getWebsite(),
				profile.getPhotoFileId(),
				details.projects(profile.getId())
					.stream()
					.map(project -> new TalentSnapshot.Project(project.title(), project.summary(), project.url(),
							project.year(), project.stage()))
					.toList(),
				profile.isComplete());
	}
}
