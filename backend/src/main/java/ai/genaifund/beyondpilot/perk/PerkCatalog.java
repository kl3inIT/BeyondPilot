package ai.genaifund.beyondpilot.perk;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.perk.PerkAudience.Held;
import ai.genaifund.beyondpilot.perk.PerkAudience.Viewer;
import ai.genaifund.beyondpilot.perk.dto.PerkCardResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkClaimResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkPageResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkSolutionResponse;
import ai.genaifund.beyondpilot.perk.dto.SolutionPerksResponse;
import ai.genaifund.beyondpilot.perk.persistence.Perk;
import ai.genaifund.beyondpilot.perk.persistence.PerkClaim;
import ai.genaifund.beyondpilot.perk.persistence.PerkClaimRepository;
import ai.genaifund.beyondpilot.perk.persistence.PerkCodeRepository;
import ai.genaifund.beyondpilot.perk.persistence.PerkRepository;
import ai.genaifund.beyondpilot.program.ProgramName;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.solution.IndexedSolution;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The published perks as anyone reads them: the catalogue, a perk's page, a program's perks and the perks on a
 * solution's card. Anyone reads every published perk and who it is for; its code or private link comes only with a
 * claim. A perk of an organization taken down is not shown.
 */
@Service
public class PerkCatalog {

	private final PerkRepository perks;

	private final PerkClaimRepository claims;

	private final PerkCodeRepository codes;

	private final PerkAudience audience;

	private final PerkViews views;

	private final OrganizationDirectory organizations;

	private final ProgramService programs;

	private final SolutionDirectory solutions;

	private final IdentityService identity;

	PerkCatalog(PerkRepository perks, PerkClaimRepository claims, PerkCodeRepository codes, PerkAudience audience,
			PerkViews views, OrganizationDirectory organizations, ProgramService programs,
			SolutionDirectory solutions, IdentityService identity) {
		this.perks = perks;
		this.claims = claims;
		this.codes = codes;
		this.audience = audience;
		this.views = views;
		this.organizations = organizations;
		this.programs = programs;
		this.solutions = solutions;
		this.identity = identity;
	}

	/**
	 * The catalogue: the published perks that have started, the latest published first, each with whether the caller
	 * may get it.
	 * @param ended whether the perks that ended are listed too
	 */
	@Transactional(readOnly = true)
	public List<PerkCardResponse> list(@Nullable Actor actor, boolean ended) {
		Instant now = Instant.now();
		return cards(perks.findByStateOrderByPublishedAtDesc(Perk.PUBLISHED)
			.stream()
			.filter(perk -> started(perk, now) && (ended || !PerkAudience.ended(perk, now)))
			.toList(), audience.viewer(actor), now);
	}

	/**
	 * The perks a program's page shows: those for its applicants or its shortlist and those an operator added there,
	 * started and not ended. None for a program that is not published.
	 */
	@Transactional(readOnly = true)
	public List<PerkCardResponse> program(String slug, @Nullable Actor actor) {
		Instant now = Instant.now();
		return programs.named(slug)
			.filter(ProgramName::published)
			.map(program -> cards(perks.findPublishedForProgram(program.id())
				.stream()
				.filter(perk -> started(perk, now) && !PerkAudience.ended(perk, now))
				.toList(), audience.viewer(actor), now))
			.orElse(List.of());
	}

	/**
	 * A perk's page, and what the caller holds of it. An archived perk is read only by those who got it.
	 * @throws PerkException when no published perk is at this address for the caller
	 */
	@Transactional(readOnly = true)
	public PerkPageResponse page(String slug, @Nullable Actor actor) {
		Perk perk = perks.findBySlug(slug)
			.filter(found -> !Perk.DRAFT.equals(found.getState()))
			.orElseThrow(() -> notFound(slug));
		Map<UUID, OrganizationName> partner = organizations.activeNames(List.of(perk.getOrganizationId()));
		Viewer viewer = audience.viewer(actor);
		PerkClaim held = audience.held(perk, viewer);
		if (partner.isEmpty() || Perk.ARCHIVED.equals(perk.getState()) && held == null) {
			throw notFound(slug);
		}
		UUID id = perk.getId();
		long active = claims.countActive(id);
		PerkCodeRepository.Stock stock = Perk.CODES.equals(perk.getWay()) ? codes.stock(id) : null;
		Instant now = Instant.now();
		PerkCardResponse card = card(perk, viewer, held, active, stock, partner, programNames(List.of(perk)), now);
		List<PerkSolutionResponse> shown = perk.getSolutionIds()
			.stream()
			.map(solutions::indexed)
			.flatMap(Optional::stream)
			.filter(IndexedSolution::listed)
			.map(solution -> new PerkSolutionResponse(solution.id(), solution.name(), solution.slug()))
			.sorted(Comparator.comparing(solution -> solution.name().toLowerCase()))
			.toList();
		PerkClaimResponse claim = held == null ? null : PerkViews.claim(perk, held, takenBy(held));
		return new PerkPageResponse(card, perk.getAbout(), views.steps(perk), perk.getTerms(), perk.getTermsUrl(),
				Perk.EVERYONE.equals(perk.getAudience()) && Perk.LINK.equals(perk.getWay()) ? perk.getUrl() : null,
				perk.getStartsAt(), views.questions(perk), perk.isRequireApproval(), perk.isPerPerson(),
				PerkAudience.placesLeft(perk, active, stock), shown, claim);
	}

	/** The open perks of each of these solutions, for their cards; a solution with none is left out. */
	@Transactional(readOnly = true)
	public List<SolutionPerksResponse> ofSolutions(Collection<UUID> solutionIds) {
		return lines(solutionIds).entrySet()
			.stream()
			.map(entry -> new SolutionPerksResponse(entry.getKey(),
					entry.getValue()
						.stream()
						.map(line -> new SolutionPerksResponse.Line(line.slug(), line.title(), line.value(),
								line.fromGenAiFund()))
						.toList()))
			.toList();
	}

	/**
	 * The open perks each of these solutions goes with, those GenAI Fund arranged first and then by title, for search
	 * to show on their cards; a solution with none is left out.
	 */
	@Transactional(readOnly = true)
	public Map<UUID, List<PerkLine>> lines(Collection<UUID> solutionIds) {
		if (solutionIds.isEmpty()) {
			return Map.of();
		}
		Instant now = Instant.now();
		List<Perk> open = perks.findPublishedWithSolutions(solutionIds)
			.stream()
			.filter(perk -> perk.isOpen(now))
			.sorted(Comparator.comparing((Perk perk) -> !perk.isFromGenAiFund())
				.thenComparing(perk -> perk.getTitle().toLowerCase()))
			.toList();
		Map<UUID, OrganizationName> partners = organizations
			.activeNames(open.stream().map(Perk::getOrganizationId).distinct().toList());
		Map<UUID, List<PerkLine>> lines = new LinkedHashMap<>();
		for (Perk perk : open) {
			if (!partners.containsKey(perk.getOrganizationId())) {
				continue;
			}
			PerkLine line = new PerkLine(perk.getSlug(), perk.getTitle(), perk.getValue(), perk.isFromGenAiFund());
			perk.getSolutionIds()
				.stream()
				.filter(solutionIds::contains)
				.forEach(solutionId -> lines.computeIfAbsent(solutionId, id -> new ArrayList<>()).add(line));
		}
		return lines;
	}

	private List<PerkCardResponse> cards(List<Perk> found, Viewer viewer, Instant now) {
		Map<UUID, OrganizationName> partners = organizations
			.activeNames(found.stream().map(Perk::getOrganizationId).distinct().toList());
		List<Perk> shown = found.stream().filter(perk -> partners.containsKey(perk.getOrganizationId())).toList();
		List<UUID> ids = shown.stream().map(Perk::getId).toList();
		Map<UUID, Map<String, Long>> states = PerkEditing.states(claims, ids);
		Map<UUID, PerkCodeRepository.Stock> stocks = codes.stocks(ids)
			.stream()
			.collect(Collectors.toMap(PerkCodeRepository.PerkStock::perkId, PerkCodeRepository.PerkStock::stock));
		Map<UUID, ProgramName> programNames = programNames(shown);
		Held held = audience.held(viewer);
		return shown.stream()
			.map(perk -> card(perk, viewer, held.of(perk),
					PerkEditing.active(states.getOrDefault(perk.getId(), Map.of())), stocks.get(perk.getId()), partners,
					programNames, now))
			.toList();
	}

	private PerkCardResponse card(Perk perk, Viewer viewer, @Nullable PerkClaim held, long active,
			PerkCodeRepository.@Nullable Stock stock, Map<UUID, OrganizationName> partners,
			Map<UUID, ProgramName> programNames, Instant now) {
		boolean full = PerkAudience.full(perk, active, stock);
		OrganizationName partner = Objects.requireNonNull(partners.get(perk.getOrganizationId()));
		ProgramName program = perk.getProgramId() == null ? null : programNames.get(perk.getProgramId());
		return new PerkCardResponse(perk.getId(), perk.getSlug(), perk.getTitle(), perk.getValue(), perk.getSummary(),
				partner.name(), partner.slug(), partner.logoFileId(), perk.getAudience(),
				program == null ? null : program.name(), program == null ? null : program.slug(), perk.getWay(),
				perk.getEndsAt(), PerkAudience.ended(perk, now), full, perk.isFromGenAiFund(),
				audience.standing(perk, viewer, held, full, now).value(), held == null ? null : held.getState());
	}

	private Map<UUID, ProgramName> programNames(List<Perk> found) {
		return programs.names(found.stream().map(Perk::getProgramId).filter(Objects::nonNull).distinct().toList());
	}

	private String takenBy(PerkClaim claim) {
		Person person = identity.people(List.of(claim.getAccountId())).get(claim.getAccountId());
		return person == null ? "" : person.label();
	}

	private static boolean started(Perk perk, Instant now) {
		return perk.getStartsAt() == null || !perk.getStartsAt().isAfter(now);
	}

	private static PerkException notFound(String slug) {
		return new PerkException(PerkErrorCode.NOT_FOUND, "No perk at " + slug + " for this caller");
	}
}
