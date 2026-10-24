package ai.genaifund.beyondpilot.perk.web;

import java.util.List;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.perk.PerkCatalog;
import ai.genaifund.beyondpilot.perk.PerkClaims;
import ai.genaifund.beyondpilot.perk.dto.ClaimPerkRequest;
import ai.genaifund.beyondpilot.perk.dto.PerkCardResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkClaimResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkPageResponse;
import ai.genaifund.beyondpilot.perk.dto.SolutionPerksResponse;
import ai.genaifund.beyondpilot.perk.dto.TeamClaimResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The published perks as anyone reads them, and the perks a team gets. */
@RestController
@RequestMapping("/api/perk")
@Tag(name = "Perks", description = "What organizations give to members of BeyondPilot, and what teams got.")
class PerksController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final PerkCatalog catalog;

	private final PerkClaims claims;

	PerksController(PerkCatalog catalog, PerkClaims claims) {
		this.catalog = catalog;
		this.claims = claims;
	}

	@GetMapping(path = "/perks", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listPerks",
			summary = "The published perks that have started, the latest published first, each with whether the caller may get it")
	@ApiResponse(responseCode = "200", description = "The perks.")
	List<PerkCardResponse> list(@CurrentActor @Nullable Actor actor,
			@Parameter(description = "Whether the perks that ended are listed too.") @RequestParam(
					defaultValue = "false") boolean ended) {
		return catalog.list(actor, ended);
	}

	@GetMapping(path = "/perks/{slug}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getPerk", summary = "A perk's page, and what the caller's team holds of it")
	@ApiResponse(responseCode = "200", description = "The perk.")
	@ApiResponse(responseCode = "404", description = "No perk is published at this address.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkPageResponse get(@PathVariable String slug, @CurrentActor @Nullable Actor actor) {
		return catalog.page(slug, actor);
	}

	@PostMapping(path = "/perks/{slug}/claims", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "claimPerk",
			summary = "Get a perk for the caller's team: open its link, take a code, or send a request",
			description = "A team that already holds it gets what it holds again.",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "What the team holds of the perk.")
	@ApiResponse(responseCode = "400", description = "The answers do not hold.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller acts for no organization, or the perk is for other teams.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "No perk is published at this address.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The perk is not open now, or every place is taken.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PerkClaimResponse claim(@PathVariable String slug, @CurrentActor Actor actor,
			@Valid @RequestBody ClaimPerkRequest request) {
		return claims.claim(actor, slug, request);
	}

	@GetMapping(path = "/solutions", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listSolutionPerks", summary = "The open perks of these solutions, for their cards")
	@ApiResponse(responseCode = "200", description = "The perks of each solution that has any.")
	@ApiResponse(responseCode = "400", description = "Too many solutions are named.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	List<SolutionPerksResponse> ofSolutions(@Parameter(description = "The solutions' addresses, up to 100.") @RequestParam(
			"slugs") @Size(max = 100) List<String> slugs) {
		return catalog.ofSolutions(slugs);
	}

	@GetMapping(path = "/solutions/with-perks", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listSolutionsWithPerks",
			summary = "The addresses of the listed solutions that go with an open perk, for the directory's perks filter")
	@ApiResponse(responseCode = "200", description = "The solutions' addresses.")
	List<String> withPerks() {
		return catalog.solutionsWithPerks();
	}

	@GetMapping(path = "/programs/{slug}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listProgramPerks",
			summary = "The perks a program's page shows: for its teams, and those an operator added there")
	@ApiResponse(responseCode = "200", description = "The perks; none for a program that is not published.")
	List<PerkCardResponse> ofProgram(@PathVariable String slug, @CurrentActor @Nullable Actor actor) {
		return catalog.program(slug, actor);
	}

	@GetMapping(path = "/claims", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listTeamClaims",
			summary = "The perks anyone in the caller's organization got, the latest first",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The perks and what the team holds of each.")
	@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	List<TeamClaimResponse> team(@CurrentActor Actor actor) {
		return claims.team(actor);
	}
}
