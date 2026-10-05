package ai.genaifund.beyondpilot.organization.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.organization.OrganizationDirectory;
import ai.genaifund.beyondpilot.organization.OrganizationService;
import ai.genaifund.beyondpilot.organization.dto.CreateOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.JoinOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.JoinOutcomeResponse;
import ai.genaifund.beyondpilot.organization.dto.OrganizationResponse;
import ai.genaifund.beyondpilot.organization.dto.OrganizationSearchResponse;
import ai.genaifund.beyondpilot.organization.dto.PublicOrganizationResponse;
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
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** How a signed-in person gets into an organization: finding one, asking to join it, creating one, an invitation. */
@RestController
@Validated
@RequestMapping("/api/organization")
@Tag(name = "Organizations", description = "Finding, joining and creating an organization.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = OrganizationsController.PROBLEM)))
class OrganizationsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private final OrganizationService organizations;

	private final OrganizationDirectory directory;

	OrganizationsController(OrganizationService organizations, OrganizationDirectory directory) {
		this.organizations = organizations;
		this.directory = directory;
	}

	@GetMapping(path = "/organizations/{slug}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getOrganization", summary = "The public page of an approved organization, read without a session")
	@ApiResponse(responseCode = "200", description = "The organization.")
	@ApiResponse(responseCode = "404", description = "No approved organization has this address.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	PublicOrganizationResponse get(@PathVariable String slug) {
		return directory.publicPage(slug);
	}

	@GetMapping(path = "/organizations", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "searchOrganizations", summary = "The approved organizations whose name contains a text",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200",
			description = "Ten organizations at most, by name; none for a text shorter than two characters.")
	@ApiResponse(responseCode = "400", description = "The text is too long.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	OrganizationSearchResponse search(@CurrentActor Actor actor,
			@Parameter(description = "A part of the name, ignoring case.") @RequestParam(
					required = false) @Size(max = 100) @Nullable String q) {
		return organizations.search(actor, q);
	}

	@PostMapping(path = "/organizations", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "createOrganization", summary = "Create an organization the caller owns",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The organization, waiting for GenAI Fund's review.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The caller already belongs to an organization, or waits on a request to join one.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	OrganizationResponse create(@CurrentActor Actor actor, @Valid @RequestBody CreateOrganizationRequest request) {
		return organizations.create(actor, request);
	}

	@PostMapping(path = "/organizations/{id}/join", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "joinOrganization", summary = "Ask to get into an organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "What asking did: joined, owner, or a request that waits.")
	@ApiResponse(responseCode = "400", description = "The message is too long.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "There is no such approved organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The caller already belongs to an organization, or waits on a request.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	JoinOutcomeResponse join(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody JoinOrganizationRequest request) {
		return organizations.join(actor, id, request.message());
	}

	@PostMapping("/join-request/withdraw")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "withdrawJoinRequest", summary = "Withdraw the request the caller waits on",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The caller waits on no request.", content = @Content)
	void withdraw(@CurrentActor Actor actor) {
		organizations.withdrawRequest(actor);
	}

	@PostMapping("/invitations/{id}/accept")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "acceptOrganizationInvitation", summary = "Accept an invitation to the caller's address",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The caller belongs to the organization.", content = @Content)
	@ApiResponse(responseCode = "404", description = "No open invitation to the caller has this identifier.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The caller already belongs to an organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void accept(@CurrentActor Actor actor, @PathVariable UUID id) {
		organizations.acceptInvitation(actor, id);
	}

	@PostMapping("/invitations/{id}/decline")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "declineOrganizationInvitation",
			summary = "Decline an invitation to the caller's address",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The invitation is closed.", content = @Content)
	@ApiResponse(responseCode = "404", description = "No open invitation to the caller has this identifier.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void decline(@CurrentActor Actor actor, @PathVariable UUID id) {
		organizations.declineInvitation(actor, id);
	}
}
