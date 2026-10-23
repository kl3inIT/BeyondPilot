package ai.genaifund.beyondpilot.perk;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.perk.PerkKeepers.Keeper;
import ai.genaifund.beyondpilot.perk.dto.AdminSavePerkRequest;
import ai.genaifund.beyondpilot.perk.dto.LoadCodesRequest;
import ai.genaifund.beyondpilot.perk.dto.LoadedCodesResponse;
import ai.genaifund.beyondpilot.perk.dto.OwnPerkResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkOptionsResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkQuestionEntry;
import ai.genaifund.beyondpilot.perk.dto.PerkResponse;
import ai.genaifund.beyondpilot.perk.dto.SavePerkRequest;
import ai.genaifund.beyondpilot.perk.persistence.Perk;
import ai.genaifund.beyondpilot.perk.persistence.PerkClaim;
import ai.genaifund.beyondpilot.perk.persistence.PerkClaimRepository;
import ai.genaifund.beyondpilot.perk.persistence.PerkCodeRepository;
import ai.genaifund.beyondpilot.perk.persistence.PerkRepository;
import ai.genaifund.beyondpilot.program.ProgramService;
import ai.genaifund.beyondpilot.solution.SolutionDirectory;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The perks organizations give, as their keepers write them. A member of the organization that gives a perk writes it
 * as a draft and publishes it, with no review; an operator does the same for any organization, marks the perks GenAI
 * Fund arranged, which then only operators change, loads code lists and adds a perk to a program's page. A perk teams
 * got is archived, never deleted, so what they got stays.
 */
@Service
public class PerkEditing {

	private static final Logger LOG = LoggerFactory.getLogger(PerkEditing.class);

	private final PerkRepository perks;

	private final PerkClaimRepository claims;

	private final PerkCodeRepository codes;

	private final PerkKeepers keepers;

	private final PerkViews views;

	private final OrganizationDirectory organizations;

	private final SolutionDirectory solutions;

	private final ProgramService programs;

	private final IdentityService identity;

	private final ApplicationEventPublisher events;

	PerkEditing(PerkRepository perks, PerkClaimRepository claims, PerkCodeRepository codes, PerkKeepers keepers,
			PerkViews views, OrganizationDirectory organizations, SolutionDirectory solutions, ProgramService programs,
			IdentityService identity, ApplicationEventPublisher events) {
		this.perks = perks;
		this.claims = claims;
		this.codes = codes;
		this.keepers = keepers;
		this.views = views;
		this.organizations = organizations;
		this.solutions = solutions;
		this.programs = programs;
		this.identity = identity;
		this.events = events;
	}

	/** The perks the caller's organization gives, the most recently changed first; none for a caller in none. */
	@Transactional(readOnly = true)
	public List<OwnPerkResponse> mine(Actor actor) {
		identity.requireActive(actor);
		return organizations.membershipOf(actor)
			.map(membership -> rows(perks.findByOrganizationIdOrderByUpdatedAtDesc(membership.organizationId())))
			.orElse(List.of());
	}

	/**
	 * Every perk, the most recently changed first.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public List<OwnPerkResponse> list(Actor actor) {
		keepers.operator(actor);
		return rows(perks.findAllByOrderByUpdatedAtDesc());
	}

	/**
	 * Every perk in the order of {@link #list}, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public List<PerkRecord> records(Actor actor) {
		return list(actor).stream().map(PerkEditing::record).toList();
	}

	/**
	 * One perk as its admin page shows it, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws PerkException when there is no such perk
	 */
	@Transactional(readOnly = true)
	public PerkRecord record(Actor actor, UUID id) {
		keepers.operator(actor);
		Perk perk = perks.findById(id).orElseThrow(() -> PerkKeepers.notFound(id));
		return record(rows(List.of(perk)).getFirst());
	}

	private static PerkRecord record(OwnPerkResponse perk) {
		return new PerkRecord(perk.id(), perk.slug(), perk.title(), perk.value(), perk.organizationId(),
				perk.organizationName(), perk.state(), perk.audience(), perk.way(), perk.fromGenAiFund(), perk.taken(),
				perk.waiting(), perk.places(), perk.codesLeft(), perk.endsAt(), perk.updatedAt());
	}

	/**
	 * Writes a draft perk of the caller's organization.
	 * @throws PerkException when the caller belongs to no organization, or the form does not hold
	 */
	@Transactional
	public PerkResponse createOwn(Actor actor, SavePerkRequest request) {
		Membership membership = keepers.member(actor);
		Person person = identity.person(actor);
		Keeper keeper = new Keeper(person.accountId(), person.label(), person.email(), false);
		return view(add(membership.organizationId(), request, keeper), keeper);
	}

	/**
	 * Writes a draft perk for the organization that gives it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws PerkException when there is no such organization, or the form does not hold
	 */
	@Transactional
	public PerkResponse create(Actor actor, AdminSavePerkRequest request) {
		Keeper keeper = keepers.operator(actor);
		UUID organizationId = request.organizationId();
		if (organizationId == null || !organizations.names(List.of(organizationId)).containsKey(organizationId)) {
			throw new PerkException(PerkErrorCode.ORGANIZATION_NOT_FOUND,
					"Perk for organization " + organizationId + ", which does not exist");
		}
		Perk perk = add(organizationId, request.perk(), keeper);
		perk.arrangedByGenAiFund(request.fromGenAiFund());
		perk.showOn(placements(request.shownOnProgramIds()));
		perks.flush();
		return view(perk, keeper);
	}

	/**
	 * A perk as its form reads it, for a member of the organization that gives it or an operator.
	 * @throws PerkException when the caller keeps no such perk
	 */
	@Transactional(readOnly = true)
	public PerkResponse get(Actor actor, UUID id) {
		Perk perk = perks.findById(id).orElseThrow(() -> PerkKeepers.notFound(id));
		return view(perk, keepers.reader(actor, perk));
	}

	/**
	 * Saves a perk as its keeper's form holds it. A published perk shows the change at once.
	 * @throws PerkException when the caller may not change it, it changed since the form read it, or the form does not
	 * hold
	 */
	@Transactional
	public PerkResponse save(Actor actor, UUID id, SavePerkRequest request) {
		Perk perk = locked(id);
		Keeper keeper = keepers.writer(actor, perk);
		Set<UUID> before = revise(perk, request);
		saved(perk, keeper, before);
		return view(perk, keeper);
	}

	/**
	 * Saves a perk as an operator's form holds it, with the mark and the programs whose page shows it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws PerkException when there is no such perk, it changed since the form read it, or the form does not hold
	 */
	@Transactional
	public PerkResponse saveAsOperator(Actor actor, UUID id, AdminSavePerkRequest request) {
		Keeper keeper = keepers.operator(actor);
		Perk perk = locked(id);
		Set<UUID> before = revise(perk, request.perk());
		perk.arrangedByGenAiFund(request.fromGenAiFund());
		perk.showOn(placements(request.shownOnProgramIds()));
		saved(perk, keeper, before);
		return view(perk, keeper);
	}

	/**
	 * Publishes a perk, or publishes it again from the archive.
	 * @throws PerkException when the caller may not change it, or it lacks what its way of getting it needs
	 */
	@Transactional
	public PerkResponse publish(Actor actor, UUID id) {
		Perk perk = locked(id);
		Keeper keeper = keepers.writer(actor, perk);
		if (Perk.CODES.equals(perk.getWay()) && codes.stock(id).loaded() == 0) {
			throw new PerkException(PerkErrorCode.INCOMPLETE, "Publication of perk " + id + ", which holds no code");
		}
		if (perk.publish()) {
			perks.flush();
			keepers.record(AuditAction.PERK_PUBLISH, keeper, perk, Map.of());
			changed(perk, Set.of());
			LOG.atInfo().addKeyValue("event", "perk.published").addKeyValue("perk_id", id).log("Perk published");
		}
		return view(perk, keeper);
	}

	/**
	 * Takes a perk off the site. Those who got it keep what they got and still read it.
	 * @throws PerkException when the caller may not change it
	 */
	@Transactional
	public PerkResponse archive(Actor actor, UUID id) {
		Perk perk = locked(id);
		Keeper keeper = keepers.writer(actor, perk);
		if (perk.archive()) {
			perks.flush();
			keepers.record(AuditAction.PERK_ARCHIVE, keeper, perk, Map.of());
			changed(perk, Set.of());
		}
		return view(perk, keeper);
	}

	/**
	 * Deletes a perk nobody got.
	 * @throws PerkException when the caller may not change it, or someone got it
	 */
	@Transactional
	public void delete(Actor actor, UUID id) {
		Perk perk = locked(id);
		Keeper keeper = keepers.writer(actor, perk);
		if (claims.countByPerkId(id) > 0) {
			throw new PerkException(PerkErrorCode.IN_USE, "Deletion of perk " + id + ", which teams got");
		}
		Set<UUID> before = perk.getSolutionIds();
		perks.delete(perk);
		perks.flush();
		keepers.record(AuditAction.PERK_DELETE, keeper, perk, Map.of());
		events.publishEvent(new PerkChanged(id, List.copyOf(before)));
	}

	/**
	 * Adds single-use codes to a perk given as a list; a code it already holds is skipped.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws PerkException when there is no such perk, or it is not given as a list
	 */
	@Transactional
	public LoadedCodesResponse loadCodes(Actor actor, UUID id, LoadCodesRequest request) {
		Keeper keeper = keepers.operator(actor);
		Perk perk = locked(id);
		if (!Perk.CODES.equals(perk.getWay())) {
			throw new PerkException(PerkErrorCode.NOT_A_CODE_LIST, "Codes for perk " + id + ", given " + perk.getWay());
		}
		List<String> loaded = request.codes().stream().map(String::strip).distinct().toList();
		int added = codes.add(id, loaded);
		keepers.record(AuditAction.PERK_CODES_LOAD, keeper, perk, Map.of("count", String.valueOf(added)));
		PerkCodeRepository.Stock stock = codes.stock(id);
		LOG.atInfo()
			.addKeyValue("event", "perk.codes_loaded")
			.addKeyValue("perk_id", id)
			.addKeyValue("count", added)
			.log("Perk codes loaded");
		return new LoadedCodesResponse(added, stock.loaded(), stock.free());
	}

	/**
	 * What a perk's form chooses from: the solutions of the organization that gives it, and the published programs.
	 * @param organizationId the organization an operator writes for; null for the caller's own
	 * @throws PerkException when the caller writes for their own organization and belongs to none
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when an organization is named and the caller is not
	 * an operator
	 */
	@Transactional(readOnly = true)
	public PerkOptionsResponse options(Actor actor, @Nullable UUID organizationId) {
		UUID giver;
		if (organizationId == null) {
			giver = keepers.member(actor).organizationId();
		}
		else {
			keepers.operator(actor);
			giver = organizationId;
		}
		return new PerkOptionsResponse(
				solutions.offeredBy(giver)
					.stream()
					.map(solution -> new PerkOptionsResponse.Option(solution.id(), solution.name()))
					.toList(),
				programs.indexedAll()
					.stream()
					.map(program -> new PerkOptionsResponse.Option(program.id(), program.name()))
					.toList());
	}

	private Perk add(UUID organizationId, SavePerkRequest request, Keeper keeper) {
		UUID id = UUID.randomUUID();
		String title = PerkViews.line(request.title());
		requireFree(organizationId, title, id);
		OrganizationName organization = organizations.names(List.of(organizationId)).get(organizationId);
		String base = PerkViews.slug((organization == null ? "" : organization.slug()) + " " + title);
		String slug = base;
		for (int suffix = 2; perks.existsBySlug(slug); suffix++) {
			slug = base + "-" + suffix;
		}
		Perk perk = new Perk(id, organizationId, slug, title);
		describe(perk, title, request);
		// An assigned identifier makes the save a merge: the copy it answers is the one the session keeps.
		Perk saved = perks.saveAndFlush(perk);
		keepers.record(AuditAction.PERK_CREATE, keeper, saved, Map.of());
		return saved;
	}

	/** Writes the form onto a locked perk read at the form's version; answers the solutions it went with before. */
	private Set<UUID> revise(Perk perk, SavePerkRequest request) {
		UUID id = perk.getId();
		if (request.version() == null || perk.getVersion() != request.version()) {
			throw new PerkException(PerkErrorCode.CHANGED_MEANWHILE,
					"Save of perk " + id + " at version " + request.version() + ", which is at " + perk.getVersion());
		}
		String title = PerkViews.line(request.title());
		requireFree(perk.getOrganizationId(), title, id);
		Set<UUID> before = perk.getSolutionIds();
		describe(perk, title, request);
		return before;
	}

	private void saved(Perk perk, Keeper keeper, Set<UUID> before) {
		perks.flush();
		keepers.record(AuditAction.PERK_UPDATE, keeper, perk, Map.of());
		changed(perk, before);
	}

	/**
	 * Keeps what the form holds, leaving out what the perk's way of getting it does not use.
	 * @throws PerkException when the program, the dates, the solutions or the questions do not hold, or the link or
	 * code its way needs is missing
	 */
	private void describe(Perk perk, String title, SavePerkRequest request) {
		String audience = request.audience();
		String way = request.way();
		UUID programId = null;
		if (Perk.APPLICANTS.equals(audience) || Perk.SHORTLISTED.equals(audience)) {
			programId = request.programId();
			if (programId == null || !programs.names(List.of(programId)).containsKey(programId)) {
				throw new PerkException(PerkErrorCode.PROGRAM_NOT_FOUND,
						"Perk " + perk.getId() + " for the teams of program " + programId + ", which does not exist");
			}
		}
		if (request.startsAt() != null && request.endsAt() != null && !request.endsAt().isAfter(request.startsAt())) {
			throw new PerkException(PerkErrorCode.DATES_NOT_VALID, "Perk " + perk.getId() + " ends before it starts");
		}
		List<UUID> solutionIds = request.solutionIds().stream().distinct().toList();
		if (!new HashSet<>(solutions.idsOf(perk.getOrganizationId())).containsAll(solutionIds)) {
			throw new PerkException(PerkErrorCode.SOLUTION_NOT_USABLE,
					"Perk " + perk.getId() + " names a solution of another organization");
		}
		boolean link = Perk.LINK.equals(way);
		boolean code = Perk.CODE.equals(way);
		boolean byRequest = Perk.REQUEST.equals(way);
		String url = link ? PerkViews.text(request.url()) : null;
		String shared = code ? PerkViews.text(request.code()) : null;
		if (link && url == null || code && shared == null) {
			throw new PerkException(PerkErrorCode.INCOMPLETE, "Perk " + perk.getId() + " given " + way + " lacks it");
		}
		List<String> steps = request.steps().stream().map(String::strip).toList();
		List<PerkQuestionEntry> questions = byRequest ? questions(perk.getId(), request.questions()) : List.of();
		perk.describe(new Perk.Description(title, PerkViews.text(request.value()), PerkViews.text(request.summary()),
				PerkViews.text(request.about()), views.write(steps), PerkViews.text(request.terms()),
				PerkViews.text(request.termsUrl()), audience, programId, way, url, shared,
				link || byRequest ? null : PerkViews.text(request.redeemUrl()), views.write(questions),
				!byRequest || request.requireApproval(), request.perPerson(),
				Perk.CODES.equals(way) || byRequest ? request.places() : null, request.startsAt(), request.endsAt()));
		perk.goWith(solutionIds);
	}

	/** The questions with an identifier each: a new one gets its own, and one asked twice is refused. */
	private static List<PerkQuestionEntry> questions(UUID perkId, List<PerkQuestionEntry> entries) {
		Set<String> seen = new HashSet<>();
		return entries.stream().map(entry -> {
			String id = entry.id() != null ? entry.id() : "q-" + UUID.randomUUID().toString().substring(0, 8);
			if (!seen.add(id)) {
				throw new PerkException(PerkErrorCode.QUESTIONS_NOT_VALID, "Perk " + perkId + " asks " + id + " twice");
			}
			return new PerkQuestionEntry(id, PerkViews.line(entry.label()), entry.multiline(), entry.required());
		}).toList();
	}

	/** The programs an operator adds the perk to, once each; one that does not exist is refused. */
	private Set<UUID> placements(List<UUID> programIds) {
		Set<UUID> chosen = new LinkedHashSet<>(programIds);
		if (!programs.names(chosen).keySet().containsAll(chosen)) {
			throw new PerkException(PerkErrorCode.PROGRAM_NOT_FOUND, "A perk shown on a program that does not exist");
		}
		return chosen;
	}

	/** A perk is told apart by its title among its organization's. */
	private void requireFree(UUID organizationId, String title, UUID id) {
		if (perks.existsOtherOfOrganization(organizationId, title, id)) {
			throw new PerkException(PerkErrorCode.TITLE_TAKEN, "A perk already reads " + title);
		}
	}

	/** Tells search, which shows a published perk on the cards of its solutions, before and after the change. */
	private void changed(Perk perk, Collection<UUID> before) {
		Set<UUID> solutionIds = new LinkedHashSet<>(before);
		solutionIds.addAll(perk.getSolutionIds());
		events.publishEvent(new PerkChanged(perk.getId(), List.copyOf(solutionIds)));
	}

	private Perk locked(UUID id) {
		return perks.findForUpdate(id).orElseThrow(() -> PerkKeepers.notFound(id));
	}

	private List<OwnPerkResponse> rows(List<Perk> found) {
		List<UUID> ids = found.stream().map(Perk::getId).toList();
		Map<UUID, Map<String, Long>> states = states(claims, ids);
		Map<UUID, PerkCodeRepository.Stock> stocks = codes.stocks(ids)
			.stream()
			.collect(Collectors.toMap(PerkCodeRepository.PerkStock::perkId, PerkCodeRepository.PerkStock::stock));
		Map<UUID, OrganizationName> names = organizations
			.names(found.stream().map(Perk::getOrganizationId).distinct().toList());
		return found.stream().map(perk -> {
			Map<String, Long> counts = states.getOrDefault(perk.getId(), Map.of());
			PerkCodeRepository.Stock stock = stocks.get(perk.getId());
			OrganizationName organization = names.get(perk.getOrganizationId());
			return new OwnPerkResponse(perk.getId(), perk.getSlug(), perk.getTitle(), perk.getValue(),
					perk.getOrganizationId(), organization == null ? "" : organization.name(), perk.getState(),
					perk.getAudience(), perk.getWay(), perk.isFromGenAiFund(), active(counts),
					counts.getOrDefault(PerkClaim.WAITING, 0L), perk.getPlaces(),
					Perk.CODES.equals(perk.getWay()) ? (stock == null ? 0 : stock.free()) : null, perk.getEndsAt(),
					perk.getUpdatedAt());
		}).toList();
	}

	private PerkResponse view(Perk perk, Keeper keeper) {
		UUID id = perk.getId();
		OrganizationName organization = organizations.names(List.of(perk.getOrganizationId()))
			.get(perk.getOrganizationId());
		PerkCodeRepository.Stock stock = codes.stock(id);
		return new PerkResponse(id, perk.getSlug(), perk.getOrganizationId(),
				organization == null ? "" : organization.name(), perk.getTitle(), perk.getValue(), perk.getSummary(),
				perk.getAbout(), views.steps(perk), perk.getTerms(), perk.getTermsUrl(), perk.getAudience(),
				perk.getProgramId(), perk.getWay(), perk.getUrl(), perk.getCode(), perk.getRedeemUrl(),
				views.questions(perk), perk.isRequireApproval(), perk.isPerPerson(), perk.getPlaces(),
				perk.getStartsAt(), perk.getEndsAt(), List.copyOf(perk.getSolutionIds()),
				List.copyOf(perk.getShownOnProgramIds()), perk.isFromGenAiFund(), perk.getState(),
				keeper.operator() || !perk.isFromGenAiFund(), claims.countActive(id),
				claims.countByPerkIdAndState(id, PerkClaim.WAITING), stock.loaded(), stock.free(), perk.getVersion(),
				perk.getUpdatedAt());
	}

	/** How many claims of each of these perks are in each state. */
	static Map<UUID, Map<String, Long>> states(PerkClaimRepository claims, Collection<UUID> perkIds) {
		if (perkIds.isEmpty()) {
			return Map.of();
		}
		Map<UUID, Map<String, Long>> states = new HashMap<>();
		claims.countByPerkAndState(perkIds)
			.forEach(row -> states.computeIfAbsent(row.getPerkId(), perkId -> new HashMap<>())
				.put(row.getState(), row.getCount()));
		return states;
	}

	/** How many of these claims hold a place: all but the declined ones. */
	static long active(Map<String, Long> counts) {
		return counts.entrySet()
			.stream()
			.filter(entry -> !PerkClaim.DECLINED.equals(entry.getKey()))
			.mapToLong(Map.Entry::getValue)
			.sum();
	}

	static <T> Map<UUID, T> byId(Collection<T> values, Function<T, UUID> id) {
		return values.stream().collect(Collectors.toMap(id, Function.identity(), (first, second) -> first));
	}
}
