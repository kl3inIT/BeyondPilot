package ai.genaifund.beyondpilot.solution;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
import ai.genaifund.beyondpilot.solution.dto.AdminOfferResponse;
import ai.genaifund.beyondpilot.solution.dto.OfferResponse;
import ai.genaifund.beyondpilot.solution.dto.OwnOfferResponse;
import ai.genaifund.beyondpilot.solution.dto.SaveOfferRequest;
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
 * claimed. There are two kinds. GenAI Fund keeps a list that every solution chooses from, which only operators
 * write. An organization writes, changes and deletes offers of its own, which only its solutions come with; no
 * review reads them, as none reads any other change to an approved solution. Operators change and delete either
 * kind. A change to an offer
 * shows at once on every solution that comes with it, and an offer is deleted only when no solution does.
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
	 * The offers a solution may come with, by title: GenAI Fund's list and those its organization wrote. For whoever
	 * writes the solution: a member of its organization, or an operator.
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
		return offerList.availableTo(solution.getOrganizationId())
			.stream()
			.map(row -> new OfferResponse(row.id(), row.title(), row.url(), row.organizationId() == null))
			.toList();
	}

	/**
	 * Every offer, GenAI Fund's first and then each organization's, with how many solutions come with each.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public List<AdminOfferResponse> list(Actor actor) {
		identity.requireOperator(actor);
		List<OfferQueryRepository.Row> rows = offerList.all();
		Map<UUID, OrganizationName> names = organizations.names(
				rows.stream().map(OfferQueryRepository.Row::organizationId).filter(Objects::nonNull).distinct().toList());
		return rows.stream().map(row -> {
			OrganizationName organization = row.organizationId() == null ? null : names.get(row.organizationId());
			return new AdminOfferResponse(row.id(), row.title(), row.url(), row.organizationId(),
					organization == null ? null : organization.name(), row.solutions(), row.version(),
					row.updatedAt());
		}).toList();
	}

	/**
	 * Adds an offer to GenAI Fund's list.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when another offer of the list reads the same
	 */
	@Transactional
	public AdminOfferResponse create(Actor actor, SaveOfferRequest request) {
		Operator operator = identity.requireOperator(actor);
		Offer offer = add(null, request);
		record(AuditAction.SOLUTION_OFFER_CREATE, operator.accountId(), operator.label(), operator.email(), offer);
		return view(offer, null, 0);
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
		Offer offer = add(membership.organizationId(), request);
		Person person = identity.person(actor);
		record(AuditAction.SOLUTION_OFFER_CREATE, person.accountId(), person.label(), person.email(), offer);
		return new OfferResponse(offer.getId(), offer.getTitle(), offer.getUrl(), false);
	}

	/** The offers the caller's organization wrote, by title; none for a caller who belongs to no organization. */
	@Transactional(readOnly = true)
	public List<OwnOfferResponse> mine(Actor actor) {
		identity.requireActive(actor);
		return organizations.membershipOf(actor)
			.map(membership -> offerList.writtenBy(membership.organizationId())
				.stream()
				.map(row -> new OwnOfferResponse(row.id(), row.title(), row.url(), row.solutions(), row.version()))
				.toList())
			.orElse(List.of());
	}

	/**
	 * Saves an offer of the caller's organization as its form holds it.
	 * @throws SolutionException when the caller belongs to no organization, the organization wrote no such offer, it
	 * changed since the form read it, or another offer of the organization reads the same
	 */
	@Transactional
	public OwnOfferResponse saveOwn(Actor actor, UUID id, SaveOfferRequest request) {
		Person person = identity.person(actor);
		Offer offer = own(actor, id);
		int withIt = change(offer, request, person.accountId(), person.label(), person.email());
		return new OwnOfferResponse(offer.getId(), offer.getTitle(), offer.getUrl(), withIt, offer.getVersion());
	}

	/**
	 * Deletes an offer of the caller's organization that no solution comes with.
	 * @throws SolutionException when the caller belongs to no organization, the organization wrote no such offer, or
	 * a solution still comes with it
	 */
	@Transactional
	public void deleteOwn(Actor actor, UUID id) {
		Person person = identity.person(actor);
		remove(own(actor, id), person.accountId(), person.label(), person.email());
	}

	/** The offer, locked, when the caller's organization wrote it; another's answers as one that does not exist. */
	private Offer own(Actor actor, UUID id) {
		Membership membership = organizations.membershipOf(actor)
			.orElseThrow(() -> new SolutionException(SolutionErrorCode.MEMBER_REQUIRED,
					"Offer change by account " + actor.accountId()));
		return offers.findForUpdate(id)
			.filter(offer -> membership.organizationId().equals(offer.getOrganizationId()))
			.orElseThrow(() -> notFound(id));
	}

	/**
	 * Saves an offer as its form holds it, GenAI Fund's or an organization's. Every solution that comes with it shows
	 * the change at once.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws SolutionException when the offer does not exist, changed since the form read it, or another offer of
	 * the same list reads the same
	 */
	@Transactional
	public AdminOfferResponse save(Actor actor, UUID id, SaveOfferRequest request) {
		Operator operator = identity.requireOperator(actor);
		Offer offer = offers.findForUpdate(id).orElseThrow(() -> notFound(id));
		int withIt = change(offer, request, operator.accountId(), operator.label(), operator.email());
		return view(offer, organizationName(offer.getOrganizationId()), withIt);
	}

	/** Writes a save of a locked offer and tells search; answers how many solutions come with the offer. */
	private int change(Offer offer, SaveOfferRequest request, UUID accountId, String label, String email) {
		UUID id = offer.getId();
		if (request.version() == null || offer.getVersion() != request.version()) {
			throw new SolutionException(SolutionErrorCode.OFFER_CHANGED_MEANWHILE,
					"Save of offer " + id + " at version " + request.version() + ", which is at " + offer.getVersion());
		}
		String title = line(request.title());
		requireFree(offer.getOrganizationId(), title, id);
		offer.describe(title, request.url().strip());
		try {
			offers.flush();
		}
		catch (DataIntegrityViolationException raced) {
			throw titleTaken(title);
		}
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
	 * Makes the solution come with the offers named, once each.
	 * @throws SolutionException when one of them does not exist, or is another organization's
	 */
	void choose(Solution solution, List<UUID> wanted) {
		List<UUID> chosen = wanted.stream().distinct().toList();
		List<Offer> found = offers.findAllById(chosen);
		if (found.size() != chosen.size()
				|| found.stream().anyMatch(offer -> !offer.isFor(solution.getOrganizationId()))) {
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
							offer.organizationId() == null), Collectors.toList())));
	}

	private Offer add(@Nullable UUID organizationId, SaveOfferRequest request) {
		UUID id = UUID.randomUUID();
		String title = line(request.title());
		requireFree(organizationId, title, id);
		try {
			return offers.saveAndFlush(new Offer(id, organizationId, title, request.url().strip()));
		}
		catch (DataIntegrityViolationException raced) {
			// Two operators took the title at once: the database's unique title decides.
			throw titleTaken(title);
		}
	}

	/** An offer is told apart by its title among those it is chosen beside: GenAI Fund's, or one organization's. */
	private void requireFree(@Nullable UUID organizationId, String title, UUID id) {
		boolean taken = organizationId == null ? offers.existsOtherOfTheList(title, id)
				: offers.existsOtherOfOrganization(organizationId, title, id);
		if (taken) {
			throw titleTaken(title);
		}
	}

	private @Nullable String organizationName(@Nullable UUID organizationId) {
		if (organizationId == null) {
			return null;
		}
		OrganizationName organization = organizations.names(List.of(organizationId)).get(organizationId);
		return organization == null ? null : organization.name();
	}

	private void record(AuditAction action, UUID accountId, String label, String email, Offer offer) {
		audit.record(new AuditRecord(action, new AuditRecord.Actor(accountId, label, email),
				new AuditRecord.Resource(OFFER, offer.getId().toString(), offer.getTitle()), Map.of()));
	}

	private static AdminOfferResponse view(Offer offer, @Nullable String organizationName, int solutions) {
		return new AdminOfferResponse(offer.getId(), offer.getTitle(), offer.getUrl(), offer.getOrganizationId(),
				organizationName, solutions, offer.getVersion(), offer.getUpdatedAt());
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
