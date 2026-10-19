package ai.genaifund.beyondpilot.solution;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.identity.Person;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationName;
import ai.genaifund.beyondpilot.solution.dto.AdminCreateOfferRequest;
import ai.genaifund.beyondpilot.solution.dto.AdminOfferDetailResponse;
import ai.genaifund.beyondpilot.solution.dto.AdminOfferResponse;
import ai.genaifund.beyondpilot.solution.dto.AdminOfferSolutionResponse;
import ai.genaifund.beyondpilot.solution.dto.AdminSaveOfferRequest;
import ai.genaifund.beyondpilot.solution.dto.OfferResponse;
import ai.genaifund.beyondpilot.solution.dto.OwnOfferResponse;
import ai.genaifund.beyondpilot.solution.dto.SaveOfferRequest;
import ai.genaifund.beyondpilot.solution.dto.SetOfferClosedRequest;
import ai.genaifund.beyondpilot.solution.persistence.Offer;
import ai.genaifund.beyondpilot.solution.persistence.OfferQueryRepository;
import ai.genaifund.beyondpilot.solution.persistence.OfferRepository;
import ai.genaifund.beyondpilot.solution.persistence.Solution;
import ai.genaifund.beyondpilot.solution.persistence.SolutionRepository;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The offers solutions come with, such as cloud credits: a line that names the offer and the page where it is
 * claimed. An offer belongs to the organization that gives it, and only that organization's solutions come with it,
 * so no solution carries a partner's offer it was not given. The organization writes, changes, closes and deletes its
 * offers with no review, as none reads any other change to an approved solution. Operators do the same for any
 * organization, such as a partner nobody has signed in for, and they alone mark an offer GenAI Fund arranged, which
 * then only they change. A change to an offer shows at once on every solution that comes with it, and an offer is
 * deleted only when no solution does.
 */
@Service
public class SolutionOffers {

	private static final String OFFER = "solution_offer";

	private final OfferRepository offers;

	private final OfferQueryRepository offerList;

	private final SolutionRepository solutions;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	private final AuditTrail audit;

	private final ApplicationEventPublisher events;

	SolutionOffers(OfferRepository offers, OfferQueryRepository offerList, SolutionRepository solutions,
			OrganizationDirectory organizations, IdentityService identity, AuditTrail audit,
			ApplicationEventPublisher events) {
		this.offers = offers;
		this.offerList = offerList;
		this.solutions = solutions;
		this.organizations = organizations;
		this.identity = identity;
		this.audit = audit;
		this.events = events;
	}

	/**
	 * The offers a solution may come with, by title: those its organization gives. For whoever writes the solution: a
	 * member of its organization, or an operator.
	 * @throws SolutionException when the solution does not exist or the caller is neither
	 */
	@Transactional(readOnly = true)
	public List<OfferResponse> options(Actor actor, UUID solutionId) {
		identity.requireActive(actor);
		Solution solution = solutions.findById(solutionId).orElseThrow(() -> noSolution(solutionId));
		boolean member = organizations.membershipOf(actor)
			.filter(membership -> membership.organizationId().equals(solution.getOrganizationId()))
			.isPresent();
		if (!member && !identity.isOperator(actor)) {
			// Another organization's solution answers as one that does not exist.
			throw noSolution(solutionId);
		}
		return offerList.availableTo(solution.getOrganizationId(), solutionId)
			.stream()
			.map(row -> new OfferResponse(row.id(), row.title(), row.url(), row.fromGenAiFund(), row.closed()))
			.toList();
	}

	/**
	 * Every offer, by the organization that gives it and then by title, with how many solutions come with each.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public List<AdminOfferResponse> list(Actor actor) {
		identity.requireOperator(actor);
		List<OfferQueryRepository.Row> rows = offerList.all();
		Map<UUID, OrganizationName> names = organizations
			.names(rows.stream().map(OfferQueryRepository.Row::organizationId).distinct().toList());
		return rows.stream()
			.map(row -> new AdminOfferResponse(row.id(), row.title(), row.url(), row.organizationId(),
					nameOf(names, row.organizationId()), row.fromGenAiFund(), row.solutions(), row.version(),
					row.updatedAt(), row.closed()))
			.sorted(Comparator.comparing((AdminOfferResponse offer) -> offer.organizationName().toLowerCase())
				.thenComparing(offer -> offer.title().toLowerCase()))
			.toList();
	}

	/**
	 * Adds an offer for the organization that gives it, which only its solutions may come with.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when there is no such organization, or another offer of it reads the same
	 */
	@Transactional
	public AdminOfferResponse create(Actor actor, AdminCreateOfferRequest request) {
		Operator operator = identity.requireOperator(actor);
		UUID organizationId = request.organizationId();
		OrganizationName organization = organizations.names(List.of(organizationId)).get(organizationId);
		if (organization == null) {
			throw new SolutionException(SolutionErrorCode.OFFER_ORGANIZATION_NOT_FOUND,
					"Offer for organization " + organizationId + ", which does not exist");
		}
		Offer offer = add(organizationId, request.title(), request.url(), request.fromGenAiFund());
		record(AuditAction.SOLUTION_OFFER_CREATE, operator.accountId(), operator.label(), operator.email(), offer);
		return view(offer, organization.name(), 0);
	}

	/**
	 * Adds an offer of the caller's organization, which its solutions may come with and no other's.
	 * @throws SolutionException when the caller belongs to no organization, or another offer of the organization
	 * reads the same
	 */
	@Transactional
	public OfferResponse createOwn(Actor actor, SaveOfferRequest request) {
		identity.requireActive(actor);
		Membership membership = organizations.membershipOf(actor)
			.orElseThrow(() -> new SolutionException(SolutionErrorCode.MEMBER_REQUIRED,
					"Offer by account " + actor.accountId()));
		Offer offer = add(membership.organizationId(), request.title(), request.url(), false);
		Person person = identity.person(actor);
		record(AuditAction.SOLUTION_OFFER_CREATE, person.accountId(), person.label(), person.email(), offer);
		return new OfferResponse(offer.getId(), offer.getTitle(), offer.getUrl(), false, false);
	}

	/** The offers the caller's organization gives, by title; none for a caller who belongs to no organization. */
	@Transactional(readOnly = true)
	public List<OwnOfferResponse> mine(Actor actor) {
		identity.requireActive(actor);
		return organizations.membershipOf(actor)
			.map(membership -> offerList.writtenBy(membership.organizationId())
				.stream()
				.map(row -> new OwnOfferResponse(row.id(), row.title(), row.url(), row.fromGenAiFund(),
						row.solutions(), row.version(), row.closed()))
				.toList())
			.orElse(List.of());
	}

	/**
	 * Saves an offer of the caller's organization as its form holds it.
	 * @throws SolutionException when the caller belongs to no organization, the organization gives no such offer,
	 * GenAI Fund arranged it, it changed since the form read it, or another offer of the organization reads the same
	 */
	@Transactional
	public OwnOfferResponse saveOwn(Actor actor, UUID id, SaveOfferRequest request) {
		Person person = identity.person(actor);
		Offer offer = own(actor, id);
		int withIt = change(offer, request.title(), request.url(), offer.isFromGenAiFund(), request.version(),
				person.accountId(), person.label(), person.email());
		return ownView(offer, withIt);
	}

	/**
	 * Deletes an offer of the caller's organization that no solution comes with.
	 * @throws SolutionException when the caller belongs to no organization, the organization gives no such offer,
	 * GenAI Fund arranged it, or a solution still comes with it
	 */
	@Transactional
	public void deleteOwn(Actor actor, UUID id) {
		Person person = identity.person(actor);
		remove(own(actor, id), person.accountId(), person.label(), person.email());
	}

	/**
	 * The offer, locked, when the caller's organization gives it and wrote it alone; another organization's answers
	 * as one that does not exist, and one GenAI Fund arranged is changed by GenAI Fund only.
	 */
	private Offer own(Actor actor, UUID id) {
		Membership membership = organizations.membershipOf(actor)
			.orElseThrow(() -> new SolutionException(SolutionErrorCode.MEMBER_REQUIRED,
					"Offer change by account " + actor.accountId()));
		Offer offer = offers.findForUpdate(id)
			.filter(found -> membership.organizationId().equals(found.getOrganizationId()))
			.orElseThrow(() -> notFound(id));
		if (offer.isFromGenAiFund()) {
			throw new SolutionException(SolutionErrorCode.OFFER_ARRANGED,
					"Change of offer " + id + ", which GenAI Fund arranged, by account " + actor.accountId());
		}
		return offer;
	}

	/**
	 * Saves an offer as its form holds it, and whether GenAI Fund arranged it. Every solution that comes with it shows
	 * the change at once.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the offer does not exist, changed since the form read it, or another offer of
	 * the organization reads the same
	 */
	@Transactional
	public AdminOfferResponse save(Actor actor, UUID id, AdminSaveOfferRequest request) {
		Operator operator = identity.requireOperator(actor);
		Offer offer = offers.findForUpdate(id).orElseThrow(() -> notFound(id));
		int withIt = change(offer, request.title(), request.url(), request.fromGenAiFund(), request.version(),
				operator.accountId(), operator.label(), operator.email());
		return view(offer, organizationName(offer.getOrganizationId()), withIt);
	}

	/** Writes a save of a locked offer and tells search; answers how many solutions come with the offer. */
	private int change(Offer offer, String typed, String url, boolean fromGenAiFund, @Nullable Long version,
			UUID accountId, String label, String email) {
		UUID id = offer.getId();
		if (version == null || offer.getVersion() != version) {
			throw new SolutionException(SolutionErrorCode.OFFER_CHANGED_MEANWHILE,
					"Save of offer " + id + " at version " + version + ", which is at " + offer.getVersion());
		}
		String title = line(typed);
		requireFree(offer.getOrganizationId(), title, id);
		offer.describe(title, url.strip());
		offer.arrangedByGenAiFund(fromGenAiFund);
		offers.flush();
		record(AuditAction.SOLUTION_OFFER_UPDATE, accountId, label, email, offer);
		List<UUID> withIt = offers.findSolutionIds(id);
		// Search shows the offer on the card of each of them, so each is read again.
		withIt.forEach(solutionId -> events.publishEvent(new SolutionChanged(solutionId)));
		return withIt.size();
	}

	/**
	 * Deletes an offer no solution comes with.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the offer does not exist, or a solution still comes with it
	 */
	@Transactional
	public void delete(Actor actor, UUID id) {
		Operator operator = identity.requireOperator(actor);
		remove(offers.findForUpdate(id).orElseThrow(() -> notFound(id)), operator.accountId(), operator.label(),
				operator.email());
	}

	private void remove(Offer offer, UUID accountId, String label, String email) {
		UUID id = offer.getId();
		if (offers.countSolutions(id) > 0) {
			throw inUse(id);
		}
		offers.delete(offer);
		try {
			offers.flush();
		}
		catch (DataIntegrityViolationException chosenMeanwhile) {
			// A solution chose it while it was being deleted: the reference in the database decides.
			throw inUse(id);
		}
		record(AuditAction.SOLUTION_OFFER_DELETE, accountId, label, email, offer);
	}

	/**
	 * The record of an offer: the offer and the solutions that come with it.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the offer does not exist
	 */
	@Transactional(readOnly = true)
	public AdminOfferDetailResponse detail(Actor actor, UUID id) {
		identity.requireOperator(actor);
		Offer offer = offers.findById(id).orElseThrow(() -> notFound(id));
		List<OfferQueryRepository.Coming> coming = offerList.solutionsWith(id);
		Map<UUID, OrganizationName> names = organizations
			.names(coming.stream().map(OfferQueryRepository.Coming::organizationId).distinct().toList());
		List<AdminOfferSolutionResponse> solutions = coming.stream().map(solution -> {
			OrganizationName organization = names.get(solution.organizationId());
			return new AdminOfferSolutionResponse(solution.id(), solution.slug(), solution.name(),
					solution.organizationId(), organization == null ? "" : organization.name(), solution.status(),
					solution.suspendedAt());
		}).toList();
		return new AdminOfferDetailResponse(view(offer, organizationName(offer.getOrganizationId()), solutions.size()),
				offer.getCreatedAt(), solutions);
	}

	/**
	 * Every offer, in the order of {@link #list}, without the solutions that come with each, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public List<SolutionOfferRecord> offerRecords(Actor actor) {
		return list(actor).stream().map(offer -> offerRecord(offer, null, List.of())).toList();
	}

	/**
	 * One offer as its admin page shows it, with the solutions that come with it, for the MCP server.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the offer does not exist
	 */
	@Transactional(readOnly = true)
	public SolutionOfferRecord offerRecord(Actor actor, UUID id) {
		AdminOfferDetailResponse found = detail(actor, id);
		return offerRecord(found.offer(), found.createdAt(), found.solutionList()
			.stream()
			.map(solution -> new SolutionOfferRecord.Solution(solution.id(), solution.name(),
					solution.organizationName(), solution.status(), solution.suspendedAt()))
			.toList());
	}

	private static SolutionOfferRecord offerRecord(AdminOfferResponse offer, @Nullable Instant createdAt,
			List<SolutionOfferRecord.Solution> solutions) {
		return new SolutionOfferRecord(offer.id(), offer.title(), offer.url(), offer.organizationId(),
				offer.organizationName(), offer.fromGenAiFund(), offer.closed(), offer.solutions(), createdAt,
				offer.updatedAt(), solutions);
	}

	/**
	 * Closes an offer to new solutions, or opens it again. The solutions that come with it keep it, and nothing shows
	 * differently on their cards.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the offer does not exist, or changed since the form read it
	 */
	@Transactional
	public AdminOfferResponse setClosed(Actor actor, UUID id, SetOfferClosedRequest request) {
		Operator operator = identity.requireOperator(actor);
		Offer offer = offers.findForUpdate(id).orElseThrow(() -> notFound(id));
		setClosed(offer, request, operator.accountId(), operator.label(), operator.email());
		return view(offer, organizationName(offer.getOrganizationId()), (int) offers.countSolutions(id));
	}

	/**
	 * Closes an offer of the caller's organization to new solutions, or opens it again.
	 * @throws SolutionException when the caller belongs to no organization, the organization wrote no such offer, or it
	 * changed since the form read it
	 */
	@Transactional
	public OwnOfferResponse setClosedOwn(Actor actor, UUID id, SetOfferClosedRequest request) {
		Person person = identity.person(actor);
		Offer offer = own(actor, id);
		setClosed(offer, request, person.accountId(), person.label(), person.email());
		return ownView(offer, (int) offers.countSolutions(id));
	}

	private void setClosed(Offer offer, SetOfferClosedRequest request, UUID accountId, String label, String email) {
		if (request.version() == null || offer.getVersion() != request.version()) {
			throw new SolutionException(SolutionErrorCode.OFFER_CHANGED_MEANWHILE, "Closing of offer " + offer.getId()
					+ " at version " + request.version() + ", which is at " + offer.getVersion());
		}
		boolean closed = request.closed();
		if (offer.closeTo(closed)) {
			offers.flush();
			record(closed ? AuditAction.SOLUTION_OFFER_CLOSE : AuditAction.SOLUTION_OFFER_REOPEN, accountId, label,
					email, offer);
		}
	}

	/**
	 * Makes the solution come with the offers named, once each.
	 * @throws SolutionException when one of them does not exist, is not the solution's organization's, or is closed
	 * and the solution does not already come with it
	 */
	void choose(Solution solution, List<UUID> wanted) {
		List<UUID> chosen = wanted.stream().distinct().toList();
		List<Offer> found = offers.findAllById(chosen);
		Set<UUID> kept = solution.getOfferIds();
		if (found.size() != chosen.size() || found.stream()
			.anyMatch(offer -> !offer.getOrganizationId().equals(solution.getOrganizationId())
					|| offer.isClosed() && !kept.contains(offer.getId()))) {
			throw new SolutionException(SolutionErrorCode.OFFER_NOT_USABLE,
					"Solution " + solution.getId() + " names an offer it may not come with");
		}
		solution.comeWith(chosen);
	}

	/** The offers a solution comes with, by title, as they are in the database now. */
	List<OfferResponse> of(UUID solutionId) {
		return of(List.of(solutionId)).getOrDefault(solutionId, List.of());
	}

	/** The offers of each of these solutions in one read; a solution that comes with none is left out. */
	Map<UUID, List<OfferResponse>> of(Collection<UUID> solutionIds) {
		return offerList.attachedTo(solutionIds)
			.stream()
			.collect(Collectors.groupingBy(OfferQueryRepository.Attached::solutionId,
					Collectors.mapping(offer -> new OfferResponse(offer.id(), offer.title(), offer.url(),
							offer.fromGenAiFund(), offer.closed()), Collectors.toList())));
	}

	private Offer add(UUID organizationId, String typed, String url, boolean fromGenAiFund) {
		UUID id = UUID.randomUUID();
		String title = line(typed);
		requireFree(organizationId, title, id);
		return offers.saveAndFlush(new Offer(id, organizationId, title, url.strip(), fromGenAiFund));
	}

	/** An offer is told apart by its title among those it is chosen beside: its organization's. */
	private void requireFree(UUID organizationId, String title, UUID id) {
		if (offers.existsOtherOfOrganization(organizationId, title, id)) {
			throw titleTaken(title);
		}
	}

	private String organizationName(UUID organizationId) {
		return nameOf(organizations.names(List.of(organizationId)), organizationId);
	}

	/** The name of an organization read in a batch; one that no longer exists reads as nothing. */
	private static String nameOf(Map<UUID, OrganizationName> names, UUID organizationId) {
		OrganizationName organization = names.get(organizationId);
		return organization == null ? "" : organization.name();
	}

	private static OwnOfferResponse ownView(Offer offer, int solutions) {
		return new OwnOfferResponse(offer.getId(), offer.getTitle(), offer.getUrl(), offer.isFromGenAiFund(), solutions,
				offer.getVersion(), offer.isClosed());
	}

	private void record(AuditAction action, UUID accountId, String label, String email, Offer offer) {
		audit.record(new AuditRecord(action, new AuditRecord.Actor(accountId, label, email),
				new AuditRecord.Resource(OFFER, offer.getId().toString(), offer.getTitle()), Map.of()));
	}

	private static AdminOfferResponse view(Offer offer, String organizationName, int solutions) {
		return new AdminOfferResponse(offer.getId(), offer.getTitle(), offer.getUrl(), offer.getOrganizationId(),
				organizationName, offer.isFromGenAiFund(), solutions, offer.getVersion(), offer.getUpdatedAt(),
				offer.isClosed());
	}

	/** What a person typed as one line: trimmed, with every run of white space made one space. */
	private static String line(String title) {
		return title.strip().replaceAll("\\s+", " ");
	}

	private static SolutionException noSolution(UUID solutionId) {
		return new SolutionException(SolutionErrorCode.SOLUTION_NOT_FOUND,
				"No solution " + solutionId + " for this caller");
	}

	private static SolutionException notFound(UUID id) {
		return new SolutionException(SolutionErrorCode.OFFER_NOT_FOUND, "No offer " + id);
	}

	private static SolutionException titleTaken(String title) {
		return new SolutionException(SolutionErrorCode.OFFER_TITLE_TAKEN, "An offer already reads " + title);
	}

	private static SolutionException inUse(UUID id) {
		return new SolutionException(SolutionErrorCode.OFFER_IN_USE,
				"Deletion of offer " + id + ", which a solution names");
	}
}
