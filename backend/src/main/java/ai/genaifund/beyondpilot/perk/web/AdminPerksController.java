package ai.genaifund.beyondpilot.perk.web;

import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.perk.PerkEditing;
import ai.genaifund.beyondpilot.perk.PerkRequests;
import ai.genaifund.beyondpilot.perk.dto.AdminSavePerkRequest;
import ai.genaifund.beyondpilot.perk.dto.DecideClaimRequest;
import ai.genaifund.beyondpilot.perk.dto.LoadCodesRequest;
import ai.genaifund.beyondpilot.perk.dto.LoadedCodesResponse;
import ai.genaifund.beyondpilot.perk.dto.OwnPerkResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkClaimRowResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkOptionsResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkResponse;
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

/**
 * Every organization's perks, which operators write for any organization, mark when GenAI Fund arranged one, load
 * code lists for and add to programs' pages.
 */
@RestController
@RequestMapping("/api/perk/admin/perks")
@Tag(name = "Perk administration", description = "The perks operators keep.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminPerksController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminPerksController.PROBLEM)))
class AdminPerksController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private static final String NOT_FOUND = "There is no such perk.";

	private final PerkEditing editing;

	private final PerkRequests requests;

	AdminPerksController(PerkEditing editing, PerkRequests requests) {
		this.editing = editing;
		this.requests = requests;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAdminPerks", summary = "Every perk, the most recently changed first",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The perks.")
	List<OwnPerkResponse> list(@CurrentActor Actor actor) {
		return editing.list(actor);
	}

	@GetMapping(path = "/options", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getAdminPerkOptions",
			summary = "The solutions of an organization and the programs a perk's form chooses from",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The choices.")
	PerkOptionsResponse options(@CurrentActor Actor actor,
			@Parameter(description = "The organization that gives the perk.") @RequestParam UUID organizationId) {
		return editing.options(actor, organizationId);
	}

	@PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "createAdminPerk", summary = "Write a draft perk for the organization that gives it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The draft.")
	@ApiResponse(responseCode = "400", description = MyPerksController.NOT_VALID,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Another perk of the organization reads the same.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkResponse create(@CurrentActor Actor actor, @Valid @RequestBody AdminSavePerkRequest request) {
		return editing.create(actor, request);
	}

	@GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getAdminPerk", summary = "A perk as its form reads it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The perk.")
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return editing.get(actor, id);
	}

	@PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveAdminPerk",
			summary = "Save a perk, with the mark and the programs whose page shows it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The perk as saved, with its new version.")
	@ApiResponse(responseCode = "400", description = MyPerksController.NOT_VALID,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The perk changed since it was read, or another reads the same.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkResponse save(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody AdminSavePerkRequest request) {
		return editing.saveAsOperator(actor, id, request);
	}

	@PostMapping(path = "/{id}/publish", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "publishAdminPerk", summary = "Publish a perk, or publish it again from the archive",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The perk, published.")
	@ApiResponse(responseCode = "400", description = "The perk lacks what its way of getting it needs.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkResponse publish(@CurrentActor Actor actor, @PathVariable UUID id) {
		return editing.publish(actor, id);
	}

	@PostMapping(path = "/{id}/archive", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "archiveAdminPerk", summary = "Take a perk off the site, keeping what teams got",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The perk, archived.")
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkResponse archive(@CurrentActor Actor actor, @PathVariable UUID id) {
		return editing.archive(actor, id);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "deleteAdminPerk", summary = "Delete a perk nobody got",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The perk is gone.", content = @Content)
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Teams got the perk; archive it instead.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void delete(@CurrentActor Actor actor, @PathVariable UUID id) {
		editing.delete(actor, id);
	}

	@PostMapping(path = "/{id}/codes", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "loadPerkCodes", summary = "Add single-use codes to a perk given as a list",
			description = "A code the perk already holds is skipped. The load is recorded with how many were new.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "What the load did, and what the list holds.")
	@ApiResponse(responseCode = "400", description = "No code is given, too many are, or one is blank or too long.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The perk is not given as a list of codes.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	LoadedCodesResponse loadCodes(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody LoadCodesRequest request) {
		return editing.loadCodes(actor, id, request);
	}

	@GetMapping(path = "/{id}/claims", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAdminPerkClaims", summary = "Who got a perk, and its requests",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The claims, the latest first.")
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	List<PerkClaimRowResponse> claims(@CurrentActor Actor actor, @PathVariable UUID id) {
		return requests.list(actor, id);
	}

	@PutMapping(path = "/{id}/claims/{claimId}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "decideAdminPerkRequest",
			summary = "Grant or decline a waiting request, for a partner nobody answers for",
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
	@Operation(operationId = "exportAdminPerkClaims", summary = "Download the claims of a perk as a spreadsheet",
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
