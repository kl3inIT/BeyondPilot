package ai.genaifund.beyondpilot.perk;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.perk.persistence.Perk;
import ai.genaifund.beyondpilot.perk.persistence.PerkClaim;
import ai.genaifund.beyondpilot.perk.persistence.PerkClaimRepository;
import ai.genaifund.beyondpilot.perk.persistence.PerkCodeRepository;
import ai.genaifund.beyondpilot.proposal.ProgramStanding;
import ai.genaifund.beyondpilot.proposal.ProgramStandings;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * Who may get a perk. Its audience is read at the moment it is asked, from the person's organization and from their
 * standing in the perk's program; a claim once made stays when the audience later changes.
 */
@Component
class PerkAudience {

	private final OrganizationDirectory organizations;

	private final ProgramStandings standings;

	private final PerkClaimRepository claims;

	PerkAudience(OrganizationDirectory organizations, ProgramStandings standings, PerkClaimRepository claims) {
		this.organizations = organizations;
		this.standings = standings;
		this.claims = claims;
	}

	/** The caller as the audience of perks: nobody, a person in no active organization, or a member of one. */
	Viewer viewer(@Nullable Actor actor) {
		if (actor == null) {
			return new Viewer(null, null, new HashMap<>());
		}
		UUID organizationId = organizations.membershipOf(actor)
			.filter(Membership::active)
			.map(Membership::organizationId)
			.orElse(null);
		return new Viewer(actor.accountId(), organizationId, new HashMap<>());
	}

	/**
	 * The latest claim that holds the perk for the viewer, declined or not: their organization's, or their own for a
	 * perk got once per person. Null when there is none.
	 */
	@Nullable PerkClaim held(Perk perk, Viewer viewer) {
		UUID accountId = viewer.accountId();
		UUID organizationId = viewer.organizationId();
		if (accountId == null) {
			return null;
		}
		if (perk.isPerPerson()) {
			return claims.findFirstByPerkIdAndAccountIdOrderByCreatedAtDesc(perk.getId(), accountId).orElse(null);
		}
		return organizationId == null ? null
				: claims.findFirstByPerkIdAndOrganizationIdOrderByCreatedAtDesc(perk.getId(), organizationId)
					.orElse(null);
	}

	/** What the viewer holds of every perk, in two reads, for a list of perks. */
	Held held(Viewer viewer) {
		Map<UUID, PerkClaim> ofOrganization = new HashMap<>();
		Map<UUID, PerkClaim> ofAccount = new HashMap<>();
		if (viewer.organizationId() != null) {
			claims.findByOrganizationIdOrderByCreatedAtDesc(viewer.organizationId())
				.forEach(claim -> ofOrganization.putIfAbsent(claim.getPerkId(), claim));
		}
		if (viewer.accountId() != null) {
			claims.findByAccountIdOrderByCreatedAtDesc(viewer.accountId())
				.forEach(claim -> ofAccount.putIfAbsent(claim.getPerkId(), claim));
		}
		return new Held(ofOrganization, ofAccount);
	}

	/** Whether the viewer is in the perk's audience, or why not; dates, places and claims aside. */
	PerkStanding qualify(Perk perk, Viewer viewer) {
		if (Perk.EVERYONE.equals(perk.getAudience()) && Perk.LINK.equals(perk.getWay())) {
			// Followed on the partner's site, with no record kept here.
			return PerkStanding.ELIGIBLE;
		}
		if (viewer.accountId() == null) {
			return PerkStanding.SIGN_IN;
		}
		UUID organizationId = viewer.organizationId();
		if (organizationId == null) {
			return PerkStanding.ORGANIZATION;
		}
		return switch (perk.getAudience()) {
			case Perk.APPLICANTS -> standing(perk, viewer, organizationId) == ProgramStanding.NONE
					? PerkStanding.NOT_APPLIED : PerkStanding.ELIGIBLE;
			case Perk.SHORTLISTED -> standing(perk, viewer, organizationId) == ProgramStanding.SHORTLISTED
					? PerkStanding.ELIGIBLE : PerkStanding.NOT_SHORTLISTED;
			default -> PerkStanding.ELIGIBLE;
		};
	}

	/**
	 * Whether the viewer may get the perk now, or the first reason they may not: what they hold comes first, so a team
	 * still reads its code after the perk ends.
	 */
	PerkStanding standing(Perk perk, Viewer viewer, @Nullable PerkClaim held, boolean full, Instant now) {
		if (held != null) {
			return PerkStanding.CLAIMED;
		}
		if (Perk.ARCHIVED.equals(perk.getState())) {
			return PerkStanding.ARCHIVED;
		}
		if (perk.getStartsAt() != null && perk.getStartsAt().isAfter(now)) {
			return PerkStanding.NOT_STARTED;
		}
		if (ended(perk, now)) {
			return PerkStanding.ENDED;
		}
		PerkStanding audience = qualify(perk, viewer);
		if (audience != PerkStanding.ELIGIBLE) {
			return audience;
		}
		return full ? PerkStanding.FULL : PerkStanding.ELIGIBLE;
	}

	private ProgramStanding standing(Perk perk, Viewer viewer, UUID organizationId) {
		UUID programId = Objects.requireNonNull(perk.getProgramId(), "A program's perk names its program");
		return viewer.standings()
			.computeIfAbsent(programId,
					id -> standings.of(id, organizationId, Objects.requireNonNull(viewer.accountId())));
	}

	static boolean ended(Perk perk, Instant now) {
		return perk.getEndsAt() != null && !perk.getEndsAt().isAfter(now);
	}

	/**
	 * Whether every place is taken: its places are held by claims not declined, and a code list ends with its last
	 * code.
	 * @param active how many claims of the perk are not declined
	 * @param stock its code list; null when it holds no code
	 */
	static boolean full(Perk perk, long active, PerkCodeRepository.@Nullable Stock stock) {
		Integer left = placesLeft(perk, active, stock);
		return left != null && left == 0;
	}

	/** How many more may get the perk; null when nothing limits it. */
	static @Nullable Integer placesLeft(Perk perk, long active, PerkCodeRepository.@Nullable Stock stock) {
		Integer places = perk.getPlaces();
		Integer left = places == null ? null : (int) Math.max(0, places - active);
		if (Perk.CODES.equals(perk.getWay())) {
			int free = stock == null ? 0 : stock.free();
			return left == null ? free : Math.min(left, free);
		}
		return left;
	}

	/** The latest claims of a viewer's organization and of the viewer, by perk. */
	record Held(Map<UUID, PerkClaim> ofOrganization, Map<UUID, PerkClaim> ofAccount) {

		@Nullable PerkClaim of(Perk perk) {
			return (perk.isPerPerson() ? ofAccount : ofOrganization).get(perk.getId());
		}
	}

	/**
	 * The caller as the audience of perks, with the program standings already read for them.
	 * @param accountId null for someone signed out
	 * @param organizationId the active organization they act for; null for none
	 */
	record Viewer(@Nullable UUID accountId, @Nullable UUID organizationId, Map<UUID, ProgramStanding> standings) {
	}
}
