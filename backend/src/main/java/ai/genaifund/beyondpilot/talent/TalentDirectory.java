package ai.genaifund.beyondpilot.talent;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ai.genaifund.beyondpilot.talent.dto.PublicTalentListRequest;
import ai.genaifund.beyondpilot.talent.dto.PublicTalentListResponse;
import ai.genaifund.beyondpilot.talent.dto.PublicTalentResponse;
import ai.genaifund.beyondpilot.talent.dto.PublicTalentSummaryResponse;
import ai.genaifund.beyondpilot.talent.persistence.TalentDetailRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfile;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfileRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentQueryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The public directory: the approved, listed profiles, read by anyone without a session. */
@Service
public class TalentDirectory {

	static final int PAGE_SIZE = 12;

	private final TalentProfileRepository profiles;

	private final TalentQueryRepository profileList;

	private final TalentDetailRepository details;

	TalentDirectory(TalentProfileRepository profiles, TalentQueryRepository profileList,
			TalentDetailRepository details) {
		this.profiles = profiles;
		this.profileList = profileList;
		this.details = details;
	}

	/** One page of the directory the request selects, by name. */
	@Transactional(readOnly = true)
	public PublicTalentListResponse list(PublicTalentListRequest request) {
		String text = TalentViews.text(request.q());
		int page = request.page() == null ? 1 : request.page();
		return new PublicTalentListResponse(profileList
			.publicPage(text, request.role(), request.availability(), request.sort(), PAGE_SIZE,
					(long) (page - 1) * PAGE_SIZE)
			.stream()
			.map(row -> new PublicTalentSummaryResponse(row.slug(), row.name(), row.headline(), row.country(),
					row.availability(), row.roles(), row.skills()))
			.toList(), page, PAGE_SIZE, profileList.publicCount(text, request.role(), request.availability()));
	}

	/** An approved, listed profile as search indexes it; empty for any other. */
	@Transactional(readOnly = true)
	public Optional<IndexedTalent> indexed(UUID profileId) {
		return profiles.findById(profileId)
			.filter(profile -> profile.isApproved() && profile.isListed())
			.map(TalentDirectory::indexed);
	}

	/** Every approved, listed profile as search indexes it, for a rebuild of the index. */
	@Transactional(readOnly = true)
	public List<IndexedTalent> indexedAll() {
		return profiles.findByStatusAndListedTrue(TalentProfile.APPROVED).stream().map(TalentDirectory::indexed).toList();
	}

	private static IndexedTalent indexed(TalentProfile profile) {
		return new IndexedTalent(profile.getId(), profile.getSlug(), profile.getName(), profile.getHeadline(),
				profile.getBio(), profile.getRoles(), profile.getSkills(), profile.getCountry(),
				profile.getAvailability());
	}

	/**
	 * One profile of the directory by its address.
	 * @throws TalentException when no approved, listed profile has the address; a draft or an unlisted one answers the
	 * same, so the address does not reveal that one exists
	 */
	@Transactional(readOnly = true)
	public PublicTalentResponse get(String slug) {
		TalentProfile profile = profiles.findBySlug(slug)
			.filter(found -> found.isApproved() && found.isListed())
			.orElseThrow(() -> new TalentException(TalentErrorCode.PROFILE_NOT_FOUND, "No listed talent at " + slug));
		return new PublicTalentResponse(profile.getSlug(), profile.getName(), profile.getHeadline(), profile.getBio(),
				profile.getRoles(), profile.getSkills(), profile.getCountry(), profile.getAvailability(),
				profile.getEngagement(), profile.getRateBand(), profile.getWebsite(),
				TalentViews.projects(details.projects(profile.getId())));
	}
}
