package ai.genaifund.beyondpilot.solution;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.organization.Membership;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.solution.dto.CreateSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.CustomerDeploymentResponse;
import ai.genaifund.beyondpilot.solution.dto.MySolutionsResponse;
import ai.genaifund.beyondpilot.solution.dto.SaveCustomerDeploymentRequest;
import ai.genaifund.beyondpilot.solution.dto.SaveSolutionRequest;
import ai.genaifund.beyondpilot.solution.dto.SolutionResponse;
import ai.genaifund.beyondpilot.solution.persistence.CustomerDeployment;
import ai.genaifund.beyondpilot.solution.persistence.CustomerDeploymentRepository;
import ai.genaifund.beyondpilot.solution.persistence.Solution;
import ai.genaifund.beyondpilot.solution.persistence.SolutionRepository;
import ai.genaifund.beyondpilot.storage.FilePurpose;
import ai.genaifund.beyondpilot.storage.StorageException;
import ai.genaifund.beyondpilot.storage.StorageService;
import ai.genaifund.beyondpilot.storage.StoredFile;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What an organization does with its solutions. Every member of an organization reads and
 * writes them, whether or not GenAI Fund has reviewed the organization yet: review decides what is listed, not who
 * takes part (BEY-37). What the caller is in their organization is read now, on every operation.
 */
@Service
public class SolutionService {

	private static final Logger LOG = LoggerFactory.getLogger(SolutionService.class);

	/** How many customer deployments one solution lists at most. */
	private static final int MAX_DEPLOYMENTS = 12;

	private final SolutionRepository solutions;

	private final CustomerDeploymentRepository deployments;

	private final OrganizationDirectory organizations;

	private final IdentityService identity;

	private final StorageService storage;

	private final ApplicationEventPublisher events;

	SolutionService(SolutionRepository solutions, CustomerDeploymentRepository deployments,
			OrganizationDirectory organizations, IdentityService identity, StorageService storage,
			ApplicationEventPublisher events) {
		this.solutions = solutions;
		this.deployments = deployments;
		this.organizations = organizations;
		this.identity = identity;
		this.storage = storage;
		this.events = events;
	}

	/** The solutions of the caller's organization, the newest first; none for a caller who belongs to no organization. */
	@Transactional(readOnly = true)
	public MySolutionsResponse mine(Actor actor) {
		identity.requireActive(actor);
		Membership membership = organizations.membershipOf(actor).orElse(null);
		if (membership == null) {
			return new MySolutionsResponse(List.of(), false);
		}
		return new MySolutionsResponse(
				solutions.findByOrganizationIdOrderByCreatedAtDesc(membership.organizationId())
					.stream()
					.map(solution -> SolutionViews.summary(solution, membership.organizationName(),
							deployments.countBySolutionIdAndStatus(solution.getId(), CustomerDeployment.IN_REVIEW)))
					.toList(),
				true);
	}

	/**
	 * One solution of the caller's organization.
	 * @throws SolutionException when the caller's organization has no such solution
	 */
	@Transactional(readOnly = true)
	public SolutionResponse get(Actor actor, UUID id) {
		identity.requireActive(actor);
		Membership membership = organizations.membershipOf(actor).orElseThrow(() -> notFound(id));
		Solution solution = solutions.findById(id)
			.filter(found -> found.getOrganizationId().equals(membership.organizationId()))
			.orElseThrow(() -> notFound(id));
		return view(solution, membership);
	}

	/**
	 * Creates a draft, which only the organization sees.
	 * @throws SolutionException when the caller is not a member
	 */
	@Transactional
	public SolutionResponse create(Actor actor, CreateSolutionRequest request) {
		Membership membership = writer(actor);
		String base = SolutionViews.slug(request.name());
		String slug = base;
		for (int suffix = 2; solutions.existsBySlug(slug); suffix++) {
			slug = base + "-" + suffix;
		}
		Solution solution = solutions.saveAndFlush(new Solution(UUID.randomUUID(), membership.organizationId(), slug,
				request.name().strip(), actor.accountId()));
		return SolutionViews.solution(solution, membership.organizationName(), null, List.of(), storage);
	}

	/**
	 * Saves a solution as its editor holds it. A change to an approved solution shows at once; one to a rejected
	 * solution waits for the owner to submit it again. A deck or an image the solution stops naming is removed from
	 * the store. A solution that was sent for review does not lose anything a review needs; one approved before a
	 * logo and a cover were asked for may stay without them.
	 * @throws SolutionException when the caller is not a member, the organization has no such
	 * solution, it changed since the screen read it, or a deck or an image it names is not a stored file the caller
	 * may give it
	 */
	@Transactional
	public SolutionResponse save(Actor actor, UUID id, SaveSolutionRequest request) {
		Membership membership = writer(actor);
		Solution solution = own(membership, id);
		if (solution.getVersion() != request.version()) {
			throw new SolutionException(SolutionErrorCode.CHANGED_MEANWHILE, "Save of solution " + id + " at version "
					+ request.version() + ", which is at " + solution.getVersion());
		}
		List<String> lackedBefore = solution.missing();
		solution.describe(request.name().strip(), SolutionViews.text(request.summary()),
				SolutionViews.text(request.problemsSolved()), SolutionViews.text(request.valueProposition()),
				request.maturity(), SolutionViews.text(request.traction()), SolutionViews.names(request.builtWith()));
		solution.fit(SolutionViews.codes(request.industries()), SolutionViews.codes(request.focusAreas()),
				SolutionViews.codes(request.languages()), SolutionViews.codes(request.deployment()),
				SolutionViews.text(request.channels()), SolutionViews.text(request.bestCustomerProfile()));
		solution.link(SolutionViews.text(request.website()), SolutionViews.text(request.demoUrl()));
		UUID replacedDeck = nameDeck(actor, solution, request.deckFileId());
		List<UUID> droppedPictures = namePictures(actor, solution, request);
		solution.list(request.listed());
		if (!solution.isDraft() && !solution.isNeedsChanges() && !solution.isRejected()
				&& !lackedBefore.containsAll(solution.missing())) {
			// What operators review, and what the directory shows, keeps what a submission needs.
			throw incomplete(id);
		}
		solutions.flush();
		// The solution no longer names these files, so nothing does. They go once the save has committed.
		if (replacedDeck != null) {
			events.publishEvent(new DroppedFiles.FileDropped(id, replacedDeck));
		}
		droppedPictures.forEach(fileId -> events.publishEvent(new DroppedFiles.FileDropped(id, fileId)));
		events.publishEvent(new SolutionChanged(id));
		return view(solution, membership);
	}

	/**
	 * Makes the solution name the deck the request names: the one it has, another stored PDF the caller uploaded for
	 * a solution, or none.
	 * @return the file the solution stopped naming, or null when it names the same as before
	 * @throws SolutionException when the file is not a stored deck of the caller, or is the deck of another solution
	 */
	private @Nullable UUID nameDeck(Actor actor, Solution solution, @Nullable UUID wanted) {
		UUID current = solution.getDeckFileId();
		if (Objects.equals(current, wanted)) {
			return null;
		}
		if (wanted == null) {
			solution.removeDeck();
			return current;
		}
		StoredFile file;
		try {
			file = storage.stored(wanted, FilePurpose.SOLUTION_DECK, actor);
		}
		catch (StorageException notUsable) {
			throw new SolutionException(SolutionErrorCode.DECK_NOT_USABLE,
					"File " + wanted + " as the deck of solution " + solution.getId(), notUsable);
		}
		if (solutions.existsByDeckFileId(wanted)) {
			throw new SolutionException(SolutionErrorCode.DECK_NOT_USABLE,
					"File " + wanted + " is the deck of another solution");
		}
		solution.attachDeck(file.id(), file.fileName(), file.sizeBytes(), Instant.now());
		return current;
	}

	/**
	 * Makes the solution name the images the request names: its logo, its cover and those under the cover. An image
	 * it already has stays, whoever of its organization uploaded it, and may move between the cover and the others;
	 * a new one is a stored image the caller uploaded for that place.
	 * @return the files the solution stopped naming
	 * @throws SolutionException when a file is not such an image, is named twice, or is the image of another solution
	 */
	private List<UUID> namePictures(Actor actor, Solution solution, SaveSolutionRequest request) {
		List<UUID> held = solution.pictures();
		UUID logo = request.logoFileId();
		UUID cover = request.coverFileId();
		List<UUID> images = request.imageFileIds();
		if (images.stream().distinct().count() != images.size() || (cover != null && images.contains(cover))) {
			throw new SolutionException(SolutionErrorCode.IMAGE_NOT_USABLE,
					"Solution " + solution.getId() + " names an image twice");
		}
		if (logo != null) {
			requirePicture(actor, solution, logo, FilePurpose.SOLUTION_LOGO, held);
		}
		if (cover != null) {
			requirePicture(actor, solution, cover, FilePurpose.SOLUTION_IMAGE, held);
		}
		images.forEach(image -> requirePicture(actor, solution, image, FilePurpose.SOLUTION_IMAGE, held));
		solution.picture(logo, cover, images);
		List<UUID> kept = solution.pictures();
		return held.stream().filter(fileId -> !kept.contains(fileId)).toList();
	}

	private void requirePicture(Actor actor, Solution solution, UUID fileId, FilePurpose purpose, List<UUID> held) {
		if (held.contains(fileId)) {
			// Already this solution's: it keeps the kind it was uploaded as, a logo or an image.
			if (storage.describe(fileId).filter(file -> file.purpose() == purpose).isEmpty()) {
				throw new SolutionException(SolutionErrorCode.IMAGE_NOT_USABLE, "File " + fileId + " of solution "
						+ solution.getId() + " is not a stored " + purpose.value());
			}
			return;
		}
		try {
			storage.stored(fileId, purpose, actor);
		}
		catch (StorageException notUsable) {
			throw new SolutionException(SolutionErrorCode.IMAGE_NOT_USABLE,
					"File " + fileId + " as a " + purpose.value() + " of solution " + solution.getId(), notUsable);
		}
		if (solutions.existsByPicture(fileId)) {
			throw new SolutionException(SolutionErrorCode.IMAGE_NOT_USABLE,
					"File " + fileId + " is an image of another solution");
		}
	}

	/**
	 * Sends a draft, or a solution GenAI Fund sent back and its owners corrected, to GenAI Fund for review.
	 * @throws SolutionException when the caller is not a member, the organization has no such
	 * solution, it lacks what a submission needs, or it is in review, approved or refused for good
	 */
	@Transactional
	public SolutionResponse submit(Actor actor, UUID id) {
		Membership membership = writer(actor);
		Solution solution = own(membership, id);
		if (!solution.isDraft() && !solution.isNeedsChanges()) {
			throw new SolutionException(SolutionErrorCode.NOT_SUBMITTABLE,
					"Submission of solution " + id + ", which is " + solution.getStatus());
		}
		if (!solution.isComplete()) {
			throw incomplete(id);
		}
		solution.submit(Instant.now(), actor.accountId());
		// The response carries the version the next save must send.
		solutions.flush();
		LOG.atInfo()
			.addKeyValue("event", "solution.submission.accepted")
			.addKeyValue("solution_id", id)
			.addKeyValue("organization_id", membership.organizationId())
			.log("Solution submitted for review");
		return view(solution, membership);
	}

	/**
	 * Deletes a draft, and its deck and its images with it. Anything that was ever submitted stays.
	 * @throws SolutionException when the caller is not a member, the organization has no such
	 * solution, or it is not a draft
	 */
	@Transactional
	public void delete(Actor actor, UUID id) {
		Solution solution = own(writer(actor), id);
		if (!solution.isDraft()) {
			throw new SolutionException(SolutionErrorCode.NOT_A_DRAFT,
					"Deletion of solution " + id + ", which is " + solution.getStatus());
		}
		List<UUID> files = new ArrayList<>(solution.pictures());
		UUID deck = solution.getDeckFileId();
		if (deck != null) {
			files.add(deck);
		}
		solutions.delete(solution);
		files.forEach(fileId -> events.publishEvent(new DroppedFiles.FileDropped(id, fileId)));
	}

	/**
	 * Adds a project in which a customer put the solution to work. It waits for GenAI Fund's review before anyone else
	 * reads it.
	 * @throws SolutionException when the caller is not a member, the organization has no such
	 * solution, or the solution already lists as many as it may
	 */
	@Transactional
	public CustomerDeploymentResponse addDeployment(Actor actor, UUID solutionId, SaveCustomerDeploymentRequest request) {
		Solution solution = own(writer(actor), solutionId);
		if (deployments.countBySolutionId(solutionId) >= MAX_DEPLOYMENTS) {
			throw new SolutionException(SolutionErrorCode.TOO_MANY_DEPLOYMENTS,
					"Solution " + solutionId + " already lists " + MAX_DEPLOYMENTS + " customer deployments");
		}
		CustomerDeployment deployment = new CustomerDeployment(UUID.randomUUID(), solution.getId());
		describe(deployment, request);
		CustomerDeploymentResponse added = SolutionViews.deployment(deployments.saveAndFlush(deployment));
		events.publishEvent(new SolutionChanged(solutionId));
		return added;
	}

	/**
	 * Saves a customer deployment as its form holds it, which sends it to review again: what it says about a customer
	 * is not shown until GenAI Fund has read it.
	 * @throws SolutionException when the caller is not a member, the solution has no such
	 * deployment, or it changed since the form read it
	 */
	@Transactional
	public CustomerDeploymentResponse saveDeployment(Actor actor, UUID solutionId, UUID id,
			SaveCustomerDeploymentRequest request) {
		CustomerDeployment deployment = ownDeployment(actor, solutionId, id);
		if (request.version() == null || deployment.getVersion() != request.version()) {
			throw new SolutionException(SolutionErrorCode.DEPLOYMENT_CHANGED_MEANWHILE, "Save of customer deployment "
					+ id + " at version " + request.version() + ", which is at " + deployment.getVersion());
		}
		describe(deployment, request);
		deployments.flush();
		// A deployment sent back to review no longer counts on the solution's card.
		events.publishEvent(new SolutionChanged(solutionId));
		return SolutionViews.deployment(deployment);
	}

	/**
	 * Removes a customer deployment, whatever its review says.
	 * @throws SolutionException when the caller is not a member or the solution has no such
	 * deployment
	 */
	@Transactional
	public void deleteDeployment(Actor actor, UUID solutionId, UUID id) {
		deployments.delete(ownDeployment(actor, solutionId, id));
		events.publishEvent(new SolutionChanged(solutionId));
	}

	private CustomerDeployment ownDeployment(Actor actor, UUID solutionId, UUID id) {
		Solution solution = own(writer(actor), solutionId);
		return deployments.findForUpdate(id)
			.filter(found -> found.getSolutionId().equals(solution.getId()))
			.orElseThrow(() -> new SolutionException(SolutionErrorCode.DEPLOYMENT_NOT_FOUND,
					"No customer deployment " + id + " of solution " + solutionId));
	}

	private static void describe(CustomerDeployment deployment, SaveCustomerDeploymentRequest request) {
		deployment.describe(request.title().strip(), request.customer().strip(), request.problem().strip(),
				request.delivered().strip(), request.stage(), SolutionViews.text(request.channels()),
				SolutionViews.text(request.languages()), SolutionViews.text(request.period()),
				SolutionViews.text(request.result()));
	}

	private SolutionResponse view(Solution solution, Membership membership) {
		return SolutionViews.solution(solution, membership.organizationName(),
				SolutionViews.sender(solution, identity),
				deployments.findBySolutionIdOrderByCreatedAtDesc(solution.getId()), storage);
	}

	private Membership writer(Actor actor) {
		identity.requireActive(actor);
		return organizations.membershipOf(actor)
			.orElseThrow(() -> new SolutionException(SolutionErrorCode.MEMBER_REQUIRED,
					"Solution change by account " + actor.accountId()));
	}

	private Solution own(Membership membership, UUID id) {
		return solutions.findForUpdate(id)
			.filter(found -> found.getOrganizationId().equals(membership.organizationId()))
			.orElseThrow(() -> notFound(id));
	}

	private static SolutionException notFound(UUID id) {
		return new SolutionException(SolutionErrorCode.SOLUTION_NOT_FOUND, "No solution " + id + " for this caller");
	}

	private static SolutionException incomplete(UUID id) {
		return new SolutionException(SolutionErrorCode.INCOMPLETE, "Solution " + id + " lacks what a submission needs");
	}
}
