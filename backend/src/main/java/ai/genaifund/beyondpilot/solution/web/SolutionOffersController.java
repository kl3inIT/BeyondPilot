package ai.genaifund.beyondpilot.solution.web;

import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.solution.SolutionOffers;
import ai.genaifund.beyondpilot.solution.dto.OfferResponse;
import ai.genaifund.beyondpilot.solution.dto.OwnOfferResponse;
import ai.genaifund.beyondpilot.solution.dto.SaveOfferRequest;
import ai.genaifund.beyondpilot.solution.dto.SetOfferClosedRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The offers a solution is given from, for whoever writes one, and the offers an organization writes for its own
 * solutions.
 */
@RestController
@RequestMapping("/api/solution/offers")
@Tag(name = "My solutions", description = "The solutions of the caller's organization.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = SolutionOffersController.PROBLEM)))
class SolutionOffersController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final SolutionOffers offers;

	SolutionOffersController(SolutionOffers offers) {
		this.offers = offers;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listSolutionOffers",
			summary = "The offers a solution may come with, by title: GenAI Fund's list and its organization's own",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The offers, by title.")
	@ApiResponse(responseCode = "404", description = "The caller writes no such solution.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	List<OfferResponse> list(@CurrentActor Actor actor, @RequestParam UUID solutionId) {
		return offers.options(actor, solutionId);
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "createOwnOffer",
			summary = "Add an offer of the caller's organization, which only its solutions may come with",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The offer.")
	@ApiResponse(responseCode = "400", description = "The title is blank or too long, or the address is not an https one.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller belongs to no organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Another offer of the organization reads the same.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	OfferResponse create(@CurrentActor Actor actor, @Valid @RequestBody SaveOfferRequest request) {
		return offers.createOwn(actor, request);
	}

	@GetMapping(path = "/mine", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listOwnOffers", summary = "The offers the caller's organization wrote, by title",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The offers; none for a caller who belongs to no organization.")
	List<OwnOfferResponse> mine(@CurrentActor Actor actor) {
		return offers.mine(actor);
	}

	@PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveOwnOffer",
			summary = "Save an offer of the caller's organization; its solutions show the change at once",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The offer as saved, with its new version.")
	@ApiResponse(responseCode = "400", description = "The title is blank or too long, or the address is not an https one.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller belongs to no organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The caller's organization wrote no such offer.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The offer changed since it was read, or another reads the same.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	OwnOfferResponse save(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SaveOfferRequest request) {
		return offers.saveOwn(actor, id, request);
	}

	@PutMapping(path = "/{id}/closed", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "setOwnOfferClosed",
			summary = "Close an offer of the caller's organization to new solutions, or open it again",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The offer as saved, with its new version.")
	@ApiResponse(responseCode = "403", description = "The caller belongs to no organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The caller's organization wrote no such offer.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The offer changed since it was read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	OwnOfferResponse setClosed(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SetOfferClosedRequest request) {
		return offers.setClosedOwn(actor, id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "deleteOwnOffer",
			summary = "Delete an offer of the caller's organization no solution comes with",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The offer is gone.", content = @Content)
	@ApiResponse(responseCode = "403", description = "The caller belongs to no organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The caller's organization wrote no such offer.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "A solution still comes with the offer.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void delete(@CurrentActor Actor actor, @PathVariable UUID id) {
		offers.deleteOwn(actor, id);
	}
}
