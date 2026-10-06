package ai.genaifund.beyondpilot.organization.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.organization.OrganizationAdministration;
import ai.genaifund.beyondpilot.organization.dto.AdminCreateOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.AdminOrganizationListRequest;
import ai.genaifund.beyondpilot.organization.dto.AdminOrganizationListResponse;
import ai.genaifund.beyondpilot.organization.dto.AdminOrganizationResponse;
import ai.genaifund.beyondpilot.organization.dto.AdminSaveOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.ApproveOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.ChangeMemberRoleRequest;
import ai.genaifund.beyondpilot.organization.dto.InviteMemberRequest;
import ai.genaifund.beyondpilot.organization.dto.RefuseOrganizationRequest;
import ai.genaifund.beyondpilot.organization.dto.TakeDownOrganizationRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The operators' work on organizations: the review of new ones, and who may own one nobody owns. */
@RestController
@RequestMapping("/api/organization/admin")
@Tag(name = "Organization administration", description = "The organizations operators review.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminOrganizationsController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminOrganizationsController.PROBLEM)))
class AdminOrganizationsController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private static final String NOT_FOUND = "There is no such organization.";

	private static final String NOT_AWAITING = "The organization is not waiting for review.";

	private final OrganizationAdministration organizations;

	AdminOrganizationsController(OrganizationAdministration organizations) {
		this.organizations = organizations;
	}

	@GetMapping(path = "/organizations", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listAdminOrganizations",
			summary = "The organizations, those waiting for review first",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of the organizations the parameters select.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminOrganizationListResponse list(@CurrentActor Actor actor,
			@Valid @ParameterObject AdminOrganizationListRequest request) {
		return organizations.list(actor, request);
	}

	@PostMapping(path = "/organizations", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(operationId = "createAdminOrganization",
			summary = "Create an organization for a company that is not here yet",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "201", description = "The organization, approved and without an owner.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "Another organization has the email domain.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminOrganizationResponse create(@CurrentActor Actor actor,
			@Valid @RequestBody AdminCreateOrganizationRequest request) {
		return organizations.create(actor, request);
	}

	@GetMapping(path = "/organizations/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getAdminOrganization", summary = "One organization as an operator reviews it",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The organization, its people and the requests to own it.")
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminOrganizationResponse get(@CurrentActor Actor actor, @PathVariable UUID id) {
		return organizations.get(actor, id);
	}

	@PostMapping(path = "/organizations/{id}/approve", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "approveOrganization",
			summary = "Approve an organization that waits for review, and verify its email domain",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The organization is approved.", content = @Content)
	@ApiResponse(responseCode = "400", description = "The domain is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The organization is not waiting for review, or another organization has the domain.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void approve(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody ApproveOrganizationRequest request) {
		organizations.approve(actor, id, request);
	}

	@PostMapping(path = "/organizations/{id}/refuse", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "refuseOrganization", summary = "Refuse an organization that waits for review",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The organization is refused, with the reason.",
			content = @Content)
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = NOT_AWAITING,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void refuse(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody RefuseOrganizationRequest request) {
		organizations.refuse(actor, id, request);
	}

	@PutMapping(path = "/organizations/{id}", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveAdminOrganization",
			summary = "Save the profile and the verified domain of an organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The organization as saved.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The organization changed since it was read, or another organization has the domain.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	AdminOrganizationResponse save(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody AdminSaveOrganizationRequest request) {
		return organizations.save(actor, id, request);
	}

	@PutMapping(path = "/organizations/{id}/members/{accountId}/role", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "changeAdminOrganizationMemberRole",
			summary = "Make a member of an organization an owner, or an owner a member",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The role is changed.", content = @Content)
	@ApiResponse(responseCode = "400", description = "The role is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The organization does not exist, or the person does not belong to it.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void changeMemberRole(@CurrentActor Actor actor, @PathVariable UUID id, @PathVariable UUID accountId,
			@Valid @RequestBody ChangeMemberRoleRequest request) {
		organizations.changeMemberRole(actor, id, accountId, request.role());
	}

	@PostMapping("/organizations/{id}/members/{accountId}/remove")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "removeAdminOrganizationMember",
			summary = "Take a person out of an organization, the last owner included",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The person is out.", content = @Content)
	@ApiResponse(responseCode = "404", description = "The organization does not exist, or the person does not belong to it.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void removeMember(@CurrentActor Actor actor, @PathVariable UUID id, @PathVariable UUID accountId) {
		organizations.removeMember(actor, id, accountId);
	}

	@PostMapping(path = "/organizations/{id}/invitations", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "inviteAdminOrganizationMember",
			summary = "Ask an address to own or join an organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The invitation is open and the address was told.",
			content = @Content)
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The address belongs to the organization or holds an open invitation.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void invite(@CurrentActor Actor actor, @PathVariable UUID id, @Valid @RequestBody InviteMemberRequest request) {
		organizations.invite(actor, id, request);
	}

	@PostMapping("/organizations/{id}/invitations/{invitationId}/revoke")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "revokeAdminOrganizationInvitation",
			summary = "Take back an open invitation of an organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The invitation is closed.", content = @Content)
	@ApiResponse(responseCode = "404", description = "The organization does not exist, or the invitation is not one of its open ones.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void revokeInvitation(@CurrentActor Actor actor, @PathVariable UUID id, @PathVariable UUID invitationId) {
		organizations.revokeInvitation(actor, id, invitationId);
	}

	@PostMapping(path = "/organizations/{id}/take-down", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "takeDownOrganization", summary = "Take an approved organization down, with a reason",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The organization is taken down.", content = @Content)
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The organization is not approved.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void takeDown(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody TakeDownOrganizationRequest request) {
		organizations.takeDown(actor, id, request);
	}

	@PostMapping("/organizations/{id}/restore")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "restoreOrganization", summary = "Return a taken-down organization to the directories",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The organization is back.", content = @Content)
	@ApiResponse(responseCode = "404", description = NOT_FOUND,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The organization is not taken down.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void restore(@CurrentActor Actor actor, @PathVariable UUID id) {
		organizations.restore(actor, id);
	}

	@PostMapping(path = "/claims/{id}/approve", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "approveOrganizationClaim",
			summary = "Let a person own an organization nobody owns, and verify its email domain",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The person owns the organization.", content = @Content)
	@ApiResponse(responseCode = "400", description = "The domain is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The claim is not open.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The person joined another organization in the meantime, or another organization has the domain.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void approveClaim(@CurrentActor Actor actor, @PathVariable UUID id,
			@Valid @RequestBody ApproveOrganizationRequest request) {
		organizations.approveClaim(actor, id, request);
	}

	@PostMapping("/claims/{id}/decline")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "declineOrganizationClaim", summary = "Decline a request to own an organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The claim is closed.", content = @Content)
	@ApiResponse(responseCode = "404", description = "The claim is not open.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void declineClaim(@CurrentActor Actor actor, @PathVariable UUID id) {
		organizations.declineClaim(actor, id);
	}
}
