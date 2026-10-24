package ai.genaifund.beyondpilot.perk;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.perk.PerkAudience.Viewer;
import ai.genaifund.beyondpilot.perk.dto.ClaimPerkRequest;
import ai.genaifund.beyondpilot.perk.dto.PerkClaimResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkQuestionEntry;
import ai.genaifund.beyondpilot.perk.dto.TeamClaimResponse;
import ai.genaifund.beyondpilot.perk.persistence.Perk;
import ai.genaifund.beyondpilot.perk.persistence.PerkClaim;
import ai.genaifund.beyondpilot.perk.persistence.PerkClaimRepository;
import ai.genaifund.beyondpilot.perk.persistence.PerkCodeRepository;
import ai.genaifund.beyondpilot.perk.persistence.PerkRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Perks as the teams they are for get them. A person gets a perk for their organization, or for themselves when it is
 * got once per person, and the claim is kept with who got it and when. The perk's row is locked while it is got, so
 * two members asking at once do not both get it and the last place goes to one team only.
 */
@Service
public class PerkClaims {

	private static final Logger LOG = LoggerFactory.getLogger(PerkClaims.class);

	private static final int SHORT_ANSWER = 200;

	private static final int LONG_ANSWER = 2000;

	private final PerkRepository perks;

	private final PerkClaimRepository claims;

	private final PerkCodeRepository codes;

	private final PerkAudience audience;

	private final PerkViews views;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	private final EmailService email;

	PerkClaims(PerkRepository perks, PerkClaimRepository claims, PerkCodeRepository codes, PerkAudience audience,
			PerkViews views, OrganizationDirectory organizations, IdentityService identity, EmailService email) {
		this.perks = perks;
		this.claims = claims;
		this.codes = codes;
		this.audience = audience;
		this.views = views;
		this.organizations = organizations;
		this.identity = identity;
		this.email = email;
	}

	/**
	 * Gets the perk at this address for the caller's team: a link opened, a code shown, or a request sent with the
	 * answers to its questions. A team that already holds it gets what it holds again. A request waiting for the
	 * partner's answer is emailed to the partner's members, and to GenAI Fund's operators when GenAI Fund arranged the
	 * perk or the partner has no members.
	 * @throws PerkException when there is no such perk, the caller acts for no organization, the perk is not open or
	 * is for other teams, its places are taken, or the answers do not hold
	 */
	@Transactional
	public PerkClaimResponse claim(Actor actor, String slug, ClaimPerkRequest request) {
		Person person = identity.person(actor);
		UUID id = perks.findBySlug(slug)
			.filter(found -> !Perk.DRAFT.equals(found.getState()))
			.map(Perk::getId)
			.orElseThrow(() -> new PerkException(PerkErrorCode.NOT_FOUND, "No perk at " + slug));
		Perk perk = perks.findForUpdate(id).orElseThrow(() -> PerkKeepers.notFound(id));
		Viewer viewer = audience.viewer(actor);
		UUID organizationId = viewer.organizationId();
		if (organizationId == null) {
			throw new PerkException(PerkErrorCode.ORGANIZATION_REQUIRED,
					"Claim of perk " + id + " by account " + actor.accountId() + ", in no organization");
		}
		PerkClaim held = audience.held(perk, viewer);
		if (held != null) {
			return PerkViews.claim(perk, held, takenBy(held));
		}
		Map<UUID, OrganizationName> names = organizations.activeNames(List.of(perk.getOrganizationId(), organizationId));
		if (!perk.isOpen(Instant.now()) || !names.containsKey(perk.getOrganizationId())) {
			throw new PerkException(PerkErrorCode.NOT_AVAILABLE, "Claim of perk " + id + ", which is not open");
		}
		PerkStanding standing = audience.qualify(perk, viewer);
		if (standing != PerkStanding.ELIGIBLE) {
			throw new PerkException(PerkErrorCode.NOT_ELIGIBLE,
					"Claim of perk " + id + " by account " + actor.accountId() + ": " + standing.value());
		}
		Integer places = perk.getPlaces();
		if (places != null && claims.countActive(id) >= places) {
			throw noPlacesLeft(id);
		}
		boolean byRequest = Perk.REQUEST.equals(perk.getWay());
		String state = !byRequest ? PerkClaim.TAKEN : perk.isRequireApproval() ? PerkClaim.WAITING : PerkClaim.GRANTED;
		String answers = views.write(byRequest ? answers(perk, request.answers()) : Map.of());
		PerkClaim claim = claims.saveAndFlush(new PerkClaim(UUID.randomUUID(), id, organizationId, person.accountId(),
				state, Perk.CODE.equals(perk.getWay()) ? perk.getCode() : null, answers));
		if (Perk.CODES.equals(perk.getWay())) {
			// The claim is rolled back with the transaction when the list has run out.
			claim.holdCode(codes.give(id, claim.getId()).orElseThrow(() -> noPlacesLeft(id)));
			claims.flush();
		}
		if (PerkClaim.WAITING.equals(state)) {
			OrganizationName requester = names.get(organizationId);
			tellPartner(perk, requester == null ? "" : requester.name());
		}
		LOG.atInfo()
			.addKeyValue("event", "perk.claimed")
			.addKeyValue("perk_id", id)
			.addKeyValue("state", state)
			.log("Perk claimed");
		return PerkViews.claim(perk, claim, person.label());
	}

	/** The perks anyone in the caller's organization got, the latest first; none for a caller in none. */
	@Transactional(readOnly = true)
	public List<TeamClaimResponse> team(Actor actor) {
		identity.requireActive(actor);
		Membership membership = organizations.membershipOf(actor).orElse(null);
		if (membership == null) {
			return List.of();
		}
		List<PerkClaim> held = claims.findByOrganizationIdOrderByCreatedAtDesc(membership.organizationId());
		Map<UUID, Perk> byId = PerkEditing.byId(perks.findAllById(held.stream().map(PerkClaim::getPerkId).toList()),
				Perk::getId);
		Map<UUID, Person> people = identity.people(held.stream().map(PerkClaim::getAccountId).distinct().toList());
		Map<UUID, OrganizationName> partners = organizations
			.names(byId.values().stream().map(Perk::getOrganizationId).distinct().toList());
		return held.stream().filter(claim -> byId.containsKey(claim.getPerkId())).map(claim -> {
			Perk perk = byId.get(claim.getPerkId());
			OrganizationName partner = partners.get(perk.getOrganizationId());
			Person person = people.get(claim.getAccountId());
			return new TeamClaimResponse(perk.getSlug(), perk.getTitle(), perk.getValue(),
					partner == null ? "" : partner.name(),
					PerkViews.claim(perk, claim, person == null ? "" : person.label()));
		}).toList();
	}

	/**
	 * The answers kept for a request: each question's, trimmed, a short one on one line.
	 * @throws PerkException when an answer names no question, a required one is missing, or one is too long
	 */
	private Map<String, String> answers(Perk perk, Map<String, String> given) {
		List<PerkQuestionEntry> questions = views.questions(perk);
		Set<String> asked = questions.stream().map(PerkQuestionEntry::id).collect(Collectors.toSet());
		if (!asked.containsAll(given.keySet())) {
			throw answersNotValid(perk.getId());
		}
		Map<String, String> kept = new LinkedHashMap<>();
		for (PerkQuestionEntry question : questions) {
			String answer = PerkViews.text(given.get(question.id()));
			if (answer == null) {
				if (question.required()) {
					throw answersNotValid(perk.getId());
				}
				continue;
			}
			if (answer.length() > (question.multiline() ? LONG_ANSWER : SHORT_ANSWER)) {
				throw answersNotValid(perk.getId());
			}
			kept.put(question.id(), question.multiline() ? answer : PerkViews.line(answer));
		}
		return kept;
	}

	/**
	 * Tells the partner's members of a request waiting for an answer, and GenAI Fund's operators when GenAI Fund
	 * arranged the perk or the partner has nobody on BeyondPilot to answer it.
	 */
	private void tellPartner(Perk perk, String requester) {
		Collection<Person> members = identity.people(organizations.memberAccountIds(perk.getOrganizationId())).values();
		members.forEach(member -> email.sendPerkRequestWaiting(member.email(), perk.getTitle(), requester,
				perk.getId(), false));
		if (perk.isFromGenAiFund() || members.isEmpty()) {
			Set<String> told = members.stream()
				.map(member -> member.email().toLowerCase(Locale.ROOT))
				.collect(Collectors.toSet());
			identity.operators()
				.stream()
				.filter(operator -> !told.contains(operator.email().toLowerCase(Locale.ROOT)))
				.forEach(operator -> email.sendPerkRequestWaiting(operator.email(), perk.getTitle(), requester,
						perk.getId(), true));
		}
	}

	private String takenBy(PerkClaim claim) {
		Person person = identity.people(List.of(claim.getAccountId())).get(claim.getAccountId());
		return person == null ? "" : person.label();
	}

	private static PerkException noPlacesLeft(UUID id) {
		return new PerkException(PerkErrorCode.NO_PLACES_LEFT, "Claim of perk " + id + ", which has no place left");
	}

	private static PerkException answersNotValid(UUID id) {
		return new PerkException(PerkErrorCode.ANSWERS_NOT_VALID, "Request for perk " + id + " with answers that do not hold");
	}
}
