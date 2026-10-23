package ai.genaifund.beyondpilot.perk;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.notification.EmailService;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.perk.PerkKeepers.Keeper;
import ai.genaifund.beyondpilot.perk.dto.DecideClaimRequest;
import ai.genaifund.beyondpilot.perk.dto.PerkClaimRowResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkQuestionEntry;
import ai.genaifund.beyondpilot.perk.persistence.Perk;
import ai.genaifund.beyondpilot.perk.persistence.PerkClaim;
import ai.genaifund.beyondpilot.perk.persistence.PerkClaimRepository;
import ai.genaifund.beyondpilot.perk.persistence.PerkRepository;
import ai.genaifund.beyondpilot.shared.Spreadsheet;
import ai.genaifund.beyondpilot.shared.SpreadsheetFile;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The claims of a perk as its keepers read them: who got it, with what, and the requests that wait for an answer. A
 * member of the organization that gives it, or an operator, grants or declines a request, and the person who sent it
 * is told; a declined request gives its place back.
 */
@Service
public class PerkRequests {

	private static final Logger LOG = LoggerFactory.getLogger(PerkRequests.class);

	private final PerkRepository perks;

	private final PerkClaimRepository claims;

	private final PerkKeepers keepers;

	private final PerkViews views;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	private final EmailService email;

	PerkRequests(PerkRepository perks, PerkClaimRepository claims, PerkKeepers keepers, PerkViews views,
			OrganizationDirectory organizations, IdentityService identity, EmailService email) {
		this.perks = perks;
		this.claims = claims;
		this.keepers = keepers;
		this.views = views;
		this.organizations = organizations;
		this.identity = identity;
		this.email = email;
	}

	/**
	 * The claims of a perk, the latest first, with the answers of each request.
	 * @throws PerkException when the caller keeps no such perk
	 */
	@Transactional(readOnly = true)
	public List<PerkClaimRowResponse> list(Actor actor, UUID perkId) {
		Perk perk = perks.findById(perkId).orElseThrow(() -> PerkKeepers.notFound(perkId));
		keepers.reader(actor, perk);
		return rows(claims.findByPerkIdOrderByCreatedAtDesc(perkId));
	}

	/**
	 * Grants or declines a waiting request, and tells the person who sent it.
	 * @throws PerkException when the caller keeps no such perk, there is no such request of it, or it was decided or
	 * changed since the list read it
	 */
	@Transactional
	public PerkClaimRowResponse decide(Actor actor, UUID perkId, UUID claimId, DecideClaimRequest request) {
		Perk perk = perks.findById(perkId).orElseThrow(() -> PerkKeepers.notFound(perkId));
		Keeper keeper = keepers.reader(actor, perk);
		PerkClaim claim = claims.findForUpdate(claimId)
			.filter(found -> found.getPerkId().equals(perkId))
			.orElseThrow(() -> new PerkException(PerkErrorCode.REQUEST_NOT_FOUND,
					"No request " + claimId + " of perk " + perkId));
		if (!PerkClaim.WAITING.equals(claim.getState()) || claim.getVersion() != request.version()) {
			throw new PerkException(PerkErrorCode.REQUEST_DECIDED, "Decision on request " + claimId + " at version "
					+ request.version() + ", which is " + claim.getState() + " at " + claim.getVersion());
		}
		boolean granted = request.granted();
		claim.decide(granted, keeper.accountId());
		claims.flush();
		keepers.record(granted ? AuditAction.PERK_REQUEST_GRANT : AuditAction.PERK_REQUEST_DECLINE, keeper, perk,
				Map.of("organization", claim.getOrganizationId().toString()));
		Person claimant = identity.people(List.of(claim.getAccountId())).get(claim.getAccountId());
		if (claimant != null) {
			OrganizationName partner = organizations.names(List.of(perk.getOrganizationId()))
				.get(perk.getOrganizationId());
			email.sendPerkRequestDecision(claimant.email(), perk.getTitle(), partner == null ? "" : partner.name(),
					granted, perk.getSlug());
		}
		LOG.atInfo()
			.addKeyValue("event", granted ? "perk.request_granted" : "perk.request_declined")
			.addKeyValue("perk_id", perkId)
			.log("Perk request decided");
		return rows(List.of(claim)).getFirst();
	}

	/**
	 * The claims of a perk as a spreadsheet, the latest first, with a column for each question. The download is
	 * recorded, as it holds the claimants' email.
	 * @throws PerkException when the caller keeps no such perk
	 * @throws ai.genaifund.beyondpilot.shared.SpreadsheetException when the download would hold too many rows
	 */
	@Transactional
	public SpreadsheetFile export(Actor actor, UUID perkId, SpreadsheetFormat format) {
		Perk perk = perks.findById(perkId).orElseThrow(() -> PerkKeepers.notFound(perkId));
		Keeper keeper = keepers.reader(actor, perk);
		List<PerkClaimRowResponse> rows = rows(claims.findByPerkIdOrderByCreatedAtDesc(perkId));
		Spreadsheet<PerkClaimRowResponse> sheet = Spreadsheet.<PerkClaimRowResponse>of("Claims")
			.text("Person", PerkClaimRowResponse::personName)
			.email("Email", PerkClaimRowResponse::personEmail)
			.text("Organization", PerkClaimRowResponse::organizationName)
			.label("State", PerkClaimRowResponse::state)
			.text("Code", PerkClaimRowResponse::code);
		for (PerkQuestionEntry question : views.questions(perk)) {
			sheet = sheet.paragraph(question.label(), row -> row.answers().get(question.id()));
		}
		sheet = sheet.time("Got at", PerkClaimRowResponse::createdAt)
			.time("Decided at", PerkClaimRowResponse::decidedAt)
			.text("Decided by", PerkClaimRowResponse::decidedBy);
		SpreadsheetFile file = sheet.write(format, "perk-claims", rows, Spreadsheet.About.of(keeper.label(), Instant.now())
			.narrowedBy("Perk", perk.getTitle()));
		keepers.record(AuditAction.PERK_CLAIMS_EXPORT, keeper, perk, Map.of("count", String.valueOf(file.rows())));
		LOG.atInfo()
			.addKeyValue("event", "perk.claims_exported")
			.addKeyValue("format", format.extension())
			.addKeyValue("count", file.rows())
			.log("Perk claims exported");
		return file;
	}

	private List<PerkClaimRowResponse> rows(List<PerkClaim> found) {
		Map<UUID, Person> people = identity.people(found.stream()
			.flatMap(claim -> Stream.of(claim.getAccountId(), claim.getDecidedByAccountId()))
			.filter(Objects::nonNull)
			.distinct()
			.toList());
		Map<UUID, OrganizationName> teams = organizations
			.names(found.stream().map(PerkClaim::getOrganizationId).distinct().toList());
		return found.stream().map(claim -> {
			Person person = people.get(claim.getAccountId());
			OrganizationName team = teams.get(claim.getOrganizationId());
			Person decider = claim.getDecidedByAccountId() == null ? null : people.get(claim.getDecidedByAccountId());
			return new PerkClaimRowResponse(claim.getId(), claim.getState(), person == null ? "" : person.label(),
					person == null ? "" : person.email(), team == null ? "" : team.name(), views.answers(claim),
					claim.getCode(), claim.getCreatedAt(), claim.getDecidedAt(),
					decider == null ? null : decider.label(), claim.getVersion());
		}).toList();
	}
}
