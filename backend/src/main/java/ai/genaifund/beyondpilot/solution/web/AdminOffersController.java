package ai.genaifund.beyondpilot.solution.web;

import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
import ai.genaifund.beyondpilot.solution.SolutionOffers;
import ai.genaifund.beyondpilot.solution.dto.AdminCreateOfferRequest;
import ai.genaifund.beyondpilot.solution.dto.AdminOfferDetailResponse;
import ai.genaifund.beyondpilot.solution.dto.AdminOfferResponse;
import ai.genaifund.beyondpilot.solution.dto.AdminSaveOfferRequest;
import ai.genaifund.beyondpilot.solution.dto.ExportOffersRequest;
import ai.genaifund.beyondpilot.solution.dto.SetOfferClosedRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

/** Every organization's offers, which operators write for an organization and mark when GenAI Fund arranged one. */
@RestController
@RequestMapping("/api/solution/admin/offers")
@Tag(name = "Solution administration", description = "The solutions operators review.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminOffersController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminOffersController.PROBLEM)))
class AdminOffersController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private static final String NOT_FOUND = "There is no such offer.";

	private static final String NOT_VALID = "The title is blank or too long, or the address is not an https one.";

	private final SolutionOffers offers;

	AdminOffersController(SolutionOffers offers) {
		this.offers = offers;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAdminOffers", summary = "Every offer, by title, with how many solutions come with it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The offers, by title.")
	List<AdminOfferResponse> list(@CurrentActor Actor actor) {
		return offers.list(actor);
	}

	@PostMapping(path = "/export", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = { SpreadsheetFormat.XLSX_TYPE, SpreadsheetFormat.CSV_TYPE })
	@Operation(operationId = "exportAdminOffers", summary = "Download the offers as a spreadsheet",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "The offers the body names, in its order, one row each. The download is recorded.",
			content = { @Content(mediaType = SpreadsheetFormat.XLSX_TYPE, schema = @Schema(type = "string", format = "binary")),
					@Content(mediaType = SpreadsheetFormat.CSV_TYPE, schema = @Schema(type = "string", format = "binary")) })
	@ApiResponse(responseCode = "400", description = "A member or the format is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ResponseEntity<byte[]> export(@CurrentActor Actor actor, @Valid @RequestBody ExportOffersRequest request,
			@Parameter(description = SpreadsheetFormat.DESCRIPTION,
					schema = @Schema(allowableValues = { "xlsx", "csv" }, defaultValue = "xlsx")) @RequestParam(
							defaultValue = "xlsx") @Pattern(regexp = SpreadsheetFormat.PATTERN) String format) {
		return offers.export(actor, request, SpreadsheetFormat.of(format)).response();
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "createOffer",
			summary = "Add an offer for the organization that gives it, which only its solutions come with",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The offer.")
	@ApiResponse(responseCode = "400", description = NOT_VALID,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Another offer of the organization reads the same.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminOfferResponse create(@CurrentActor Actor actor, @Valid @RequestBody AdminCreateOfferRequest request) {
		return offers.create(actor, request);
	}

	@PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveOffer",
			summary = "Save an offer; every solution that comes with it shows the change at once",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The offer as saved, with its new version.")
	@ApiResponse(responseCode = "400", description = NOT_VALID,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The offer changed since it was read, or another reads the same.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminOfferResponse save(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody AdminSaveOfferRequest request) {
		return offers.save(actor, id, request);
	}

	@GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getAdminOffer", summary = "One offer with the solutions that come with it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The offer and its solutions, by name.")
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminOfferDetailResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return offers.detail(actor, id);
	}

	@PutMapping(path = "/{id}/closed", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "setOfferClosed",
			summary = "Close an offer to new solutions, or open it again; the solutions that come with it keep it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The offer as saved, with its new version.")
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The offer changed since it was read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminOfferResponse setClosed(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody SetOfferClosedRequest request) {
		return offers.setClosed(actor, id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "deleteOffer", summary = "Delete an offer no solution comes with",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The offer is gone.", content = @Content)
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "A solution still comes with the offer.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void delete(@CurrentActor Actor actor, @PathVariable UUID id) {
		offers.delete(actor, id);
	}
}
