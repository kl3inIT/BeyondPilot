package ai.genaifund.beyondpilot.proposal.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.proposal.ProposalService;
import ai.genaifund.beyondpilot.proposal.dto.ApplicantOrganizationRequest;
import ai.genaifund.beyondpilot.proposal.dto.ApplicationViewResponse;
import ai.genaifund.beyondpilot.proposal.dto.MyApplicationsResponse;
import ai.genaifund.beyondpilot.proposal.dto.SaveApplicationRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** A signed-in person's applications to programs. */
@RestController
@RequestMapping("/api/proposal")
@Tag(name = "Applications", description = "A person's applications to programs.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = ApplicationsController.PROBLEM)))
class ApplicationsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final ProposalService proposals;

	ApplicationsController(ProposalService proposals) {
		this.proposals = proposals;
	}

	@GetMapping(path = "/programs/{slug}/application", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getApplicationForm", summary = "The application form of a program for the caller",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "The program's questions, the caller's application if they saved one, their organization and its solutions.")
	@ApiResponse(responseCode = "409", description = "The program takes no applications on BeyondPilot.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ApplicationViewResponse form(@CurrentActor Actor actor, @PathVariable String slug) {
		return proposals.view(actor, slug);
	}

	@PutMapping(path = "/programs/{slug}/application", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveApplication", summary = "Keep what the application form holds",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The form with the application as saved.")
	@ApiResponse(responseCode = "400",
			description = "A member is not valid, an answer does not fit its question, or the solution is not the organization's.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The program takes no applications now, the application changed since it was read, or it can no longer change.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ApplicationViewResponse save(@CurrentActor Actor actor, @PathVariable String slug,
			@Valid @RequestBody SaveApplicationRequest request) {
		return proposals.save(actor, slug, request);
	}

	@PostMapping(path = "/programs/{slug}/application/organization", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "organizeApplicant",
			summary = "Make the organization of someone who applies on their own or with a team",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The form, with the new organization.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The program takes no applications now, or the caller already belongs to an organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ApplicationViewResponse organize(@CurrentActor Actor actor, @PathVariable String slug,
			@Valid @RequestBody ApplicantOrganizationRequest request) {
		return proposals.organize(actor, slug, request);
	}

	@GetMapping(path = "/applications", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listMyApplications", summary = "The caller's applications",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The applications, the most recently changed first.")
	MyApplicationsResponse mine(@CurrentActor Actor actor) {
		return proposals.mine(actor);
	}

	@GetMapping(path = "/applications/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMyApplication", summary = "One of the caller's applications with its form",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The application and its program.")
	@ApiResponse(responseCode = "404", description = "The caller has no such application.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ApplicationViewResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return proposals.view(actor, id);
	}

	@PostMapping(path = "/applications/{id}/submit", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "submitApplication", summary = "Submit an application, or submit it again",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The application as submitted. A copy goes by email.")
	@ApiResponse(responseCode = "400", description = "The application lacks what a submission needs; its code says what.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The caller has no such application.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The applications have closed, it can no longer change, or someone in the organization already applied.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ApplicationViewResponse submit(@CurrentActor Actor actor, @PathVariable UUID id) {
		return proposals.submit(actor, id);
	}

	@PostMapping(path = "/applications/{id}/withdraw", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "withdrawApplication", summary = "Withdraw a submitted application",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The application, withdrawn.")
	@ApiResponse(responseCode = "404", description = "The caller has no such application.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "It is not submitted, or the applications have closed.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	ApplicationViewResponse withdraw(@CurrentActor Actor actor, @PathVariable UUID id) {
		return proposals.withdraw(actor, id);
	}
}
