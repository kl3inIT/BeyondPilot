package ai.genaifund.beyondpilot.perk.web;

import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.perk.PerkEditing;
import ai.genaifund.beyondpilot.perk.PerkRequests;
import ai.genaifund.beyondpilot.perk.dto.DecideClaimRequest;
import ai.genaifund.beyondpilot.perk.dto.OwnPerkResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkClaimRowResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkOptionsResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkResponse;
import ai.genaifund.beyondpilot.perk.dto.SavePerkRequest;
import ai.genaifund.beyondpilot.shared.SpreadsheetFormat;
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

/** The perks the caller's organization gives, which its members write, publish and answer the requests of. */
@RestController
@RequestMapping("/api/perk/mine")
@Tag(name = "Perks", description = "What organizations give to members of BeyondPilot, and what teams got.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = MyPerksController.PROBLEM)))
class MyPerksController {

	static final String PROBLEM = "#/components/schemas/Problem";

	static final String NOT_FOUND = "The caller's organization gives no such perk.";

	static final String NOT_VALID = "A field is blank, too long or not an https address, or the program, the dates, "
			+ "the solutions, the questions, or the link or code the perk needs do not hold.";

	static final String ARRANGED = "GenAI Fund arranged the perk, so only an operator changes it.";

	private final PerkEditing editing;

	private final PerkRequests requests;

	MyPerksController(PerkEditing editing, PerkRequests requests) {
		this.editing = editing;
		this.requests = requests;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listMyPerks", summary = "The perks the caller's organization gives",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The perks, the most recently changed first.")
	List<OwnPerkResponse> list(@CurrentActor Actor actor) {
		return editing.mine(actor);
	}

	@GetMapping(path = "/options", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMyPerkOptions",
			summary = "The solutions of the caller's organization and the programs a perk's form chooses from",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The choices.")
	@ApiResponse(responseCode = "403", description = "The caller belongs to no organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkOptionsResponse options(@CurrentActor Actor actor) {
		return editing.options(actor, null);
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "createMyPerk", summary = "Write a draft perk of the caller's organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The draft.")
	@ApiResponse(responseCode = "400", description = NOT_VALID,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller belongs to no organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Another perk of the organization reads the same.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkResponse create(@CurrentActor Actor actor, @Valid @RequestBody SavePerkRequest request) {
		return editing.createOwn(actor, request);
	}

	@GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMyPerk", summary = "A perk of the caller's organization as its form reads it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The perk.")
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return editing.get(actor, id);
	}

	@PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveMyPerk", summary = "Save a perk of the caller's organization",
			description = "A published perk shows the change at once.", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The perk as saved, with its new version.")
	@ApiResponse(responseCode = "400", description = NOT_VALID,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = ARRANGED,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The perk changed since it was read, or another reads the same.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkResponse save(@CurrentActor Actor actor, @PathVariable UUID id, @Valid @RequestBody SavePerkRequest request) {
		return editing.save(actor, id, request);
	}

	@PostMapping(path = "/{id}/publish", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "publishMyPerk", summary = "Publish a perk, or publish it again from the archive",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The perk, published.")
	@ApiResponse(responseCode = "400", description = "The perk lacks what its way of getting it needs.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = ARRANGED,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkResponse publish(@CurrentActor Actor actor, @PathVariable UUID id) {
		return editing.publish(actor, id);
	}

	@PostMapping(path = "/{id}/archive", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "archiveMyPerk", summary = "Take a perk off the site, keeping what teams got",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The perk, archived.")
	@ApiResponse(responseCode = "403", description = ARRANGED,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkResponse archive(@CurrentActor Actor actor, @PathVariable UUID id) {
		return editing.archive(actor, id);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "deleteMyPerk", summary = "Delete a perk nobody got",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The perk is gone.", content = @Content)
	@ApiResponse(responseCode = "403", description = ARRANGED,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Teams got the perk; archive it instead.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void delete(@CurrentActor Actor actor, @PathVariable UUID id) {
		editing.delete(actor, id);
	}

	@GetMapping(path = "/{id}/claims", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listMyPerkClaims", summary = "Who got a perk of the caller's organization, and its requests",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The claims, the latest first.")
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	List<PerkClaimRowResponse> claims(@CurrentActor Actor actor, @PathVariable UUID id) {
		return requests.list(actor, id);
	}

	@PutMapping(path = "/{id}/claims/{claimId}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "decideMyPerkRequest", summary = "Grant or decline a waiting request",
			description = "The person who sent it is emailed.", security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The request as decided.")
	@ApiResponse(responseCode = "404", description = "There is no such perk or request.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The request was decided or changed since it was read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkClaimRowResponse decide(@CurrentActor Actor actor, @PathVariable UUID id, @PathVariable UUID claimId,
			@Valid @RequestBody DecideClaimRequest request) {
		return requests.decide(actor, id, claimId, request);
	}

	@GetMapping(path = "/{id}/claims/export", produces = { SpreadsheetFormat.XLSX_TYPE, SpreadsheetFormat.CSV_TYPE })
	@Operation(operationId = "exportMyPerkClaims", summary = "Download the claims of a perk as a spreadsheet",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "The claims, the latest first, with a column for each question. The download is recorded.",
			content = { @Content(mediaType = SpreadsheetFormat.XLSX_TYPE, schema = @Schema(type = "string", format = "binary")),
					@Content(mediaType = SpreadsheetFormat.CSV_TYPE, schema = @Schema(type = "string", format = "binary")) })
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ResponseEntity<byte[]> export(@CurrentActor Actor actor, @PathVariable UUID id,
			@Parameter(description = SpreadsheetFormat.DESCRIPTION,
					schema = @Schema(allowableValues = { "xlsx", "csv" }, defaultValue = "xlsx")) @RequestParam(
							defaultValue = "xlsx") @Pattern(regexp = SpreadsheetFormat.PATTERN) String format) {
		return requests.export(actor, id, SpreadsheetFormat.of(format)).response();
	}
}
