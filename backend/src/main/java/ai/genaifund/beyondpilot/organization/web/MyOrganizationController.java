package ai.genaifund.beyondpilot.organization.web;

import java.util.UUID;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.organization.OrganizationService;
import ai.genaifund.beyondpilot.organization.dto.AutoJoinRequest;
import ai.genaifund.beyondpilot.organization.dto.ChangeMemberRoleRequest;
import ai.genaifund.beyondpilot.organization.dto.InviteMemberRequest;
import ai.genaifund.beyondpilot.organization.dto.JobTitleRequest;
import ai.genaifund.beyondpilot.organization.dto.MembersResponse;
import ai.genaifund.beyondpilot.organization.dto.MyOrganizationResponse;
import ai.genaifund.beyondpilot.organization.dto.OrganizationResponse;
import ai.genaifund.beyondpilot.organization.dto.SaveOrganizationRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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

/** The organization the caller belongs to: its profile, its people, and who may get in. */
@RestController
@RequestMapping("/api/organization/mine")
@Tag(name = "My organization", description = "The organization the caller belongs to.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = MyOrganizationController.PROBLEM)))
class MyOrganizationController {

	static final String PROBLEM = "#/components/schemas/Problem";

	private static final String NOT_OWNER = "The caller belongs to no organization, or is not an owner of it.";

	private final OrganizationService organizations;

	MyOrganizationController(OrganizationService organizations) {
		this.organizations = organizations;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMyOrganization",
			summary = "The caller's organization, or their ways into one",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "Where the caller stands.")
	MyOrganizationResponse mine(@CurrentActor Actor actor) {
		return organizations.mine(actor);
	}

	@PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "saveMyOrganization", summary = "Save the profile of the caller's organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The organization as saved, with its new version.")
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = NOT_OWNER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The organization changed since it was read.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	OrganizationResponse save(@CurrentActor Actor actor, @Valid @RequestBody SaveOrganizationRequest request) {
		return organizations.save(actor, request);
	}

	@GetMapping(path = "/members", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listMyOrganizationMembers", summary = "Who belongs to the caller's organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The members, and for an owner the open invitations and requests.")
	@ApiResponse(responseCode = "403", description = "The caller belongs to no organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	MembersResponse members(@CurrentActor Actor actor) {
		return organizations.members(actor);
	}

	@PostMapping(path = "/invitations", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "inviteOrganizationMember", summary = "Ask an address to join the caller's organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The invitation is open and the address was told.",
			content = @Content)
	@ApiResponse(responseCode = "400", description = "A member is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = NOT_OWNER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "The organization is not approved, or the address already belongs to it or already holds an open invitation.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "429",
			description = "The organization sent the most invitations it can in a day, or keeps the most it can open.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void invite(@CurrentActor Actor actor, @Valid @RequestBody InviteMemberRequest request) {
		organizations.invite(actor, request);
	}

	@PostMapping("/invitations/{id}/revoke")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "revokeOrganizationInvitation", summary = "Take back an open invitation",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The invitation is closed.", content = @Content)
	@ApiResponse(responseCode = "403", description = NOT_OWNER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The invitation is not open.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void revoke(@CurrentActor Actor actor, @PathVariable UUID id) {
		organizations.revokeInvitation(actor, id);
	}

	@PostMapping("/requests/{id}/approve")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "approveJoinRequest", summary = "Let a person who asked join",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The person is a member.", content = @Content)
	@ApiResponse(responseCode = "403", description = NOT_OWNER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The request is not open.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The person joined another organization in the meantime.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void approveRequest(@CurrentActor Actor actor, @PathVariable UUID id) {
		organizations.decideRequest(actor, id, true);
	}

	@PostMapping("/requests/{id}/decline")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "declineJoinRequest", summary = "Decline a request to join",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The request is closed.", content = @Content)
	@ApiResponse(responseCode = "403", description = NOT_OWNER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The request is not open.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void declineRequest(@CurrentActor Actor actor, @PathVariable UUID id) {
		organizations.decideRequest(actor, id, false);
	}

	@PutMapping(path = "/members/{accountId}/role", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "changeOrganizationMemberRole", summary = "Make a member an owner, or an owner a member",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The person has the role.", content = @Content)
	@ApiResponse(responseCode = "400", description = "The role is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = NOT_OWNER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The person does not belong to the organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The change would leave the organization without an owner.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void changeRole(@CurrentActor Actor actor, @PathVariable UUID accountId,
			@Valid @RequestBody ChangeMemberRoleRequest request) {
		organizations.changeRole(actor, accountId, request.role());
	}

	@PostMapping("/members/{accountId}/remove")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "removeOrganizationMember",
			summary = "Take a person out of the organization; a member may only take themselves out",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The person no longer belongs to the organization.",
			content = @Content)
	@ApiResponse(responseCode = "403", description = "The caller belongs to no organization, or removes someone else without being an owner.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "404", description = "The person does not belong to the organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409", description = "The removal would leave the organization without an owner.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void remove(@CurrentActor Actor actor, @PathVariable UUID accountId) {
		organizations.remove(actor, accountId);
	}

	@PutMapping(path = "/job-title", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "changeMyJobTitle", summary = "Set what the caller does in their organization",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The job title is saved.", content = @Content)
	@ApiResponse(responseCode = "400", description = "The job title is too long.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = "The caller belongs to no organization.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void changeJobTitle(@CurrentActor Actor actor, @Valid @RequestBody JobTitleRequest request) {
		organizations.changeJobTitle(actor, request.jobTitle());
	}

	@PutMapping(path = "/auto-join", consumes = MediaType.APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "changeOrganizationAutoJoin",
			summary = "Let addresses on the organization's verified domain join without asking, or stop that",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "The setting is saved.", content = @Content)
	@ApiResponse(responseCode = "400", description = "The value is missing.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "403", description = NOT_OWNER,
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	@ApiResponse(responseCode = "409",
			description = "Turned on for an organization that is not approved or has no verified domain.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void changeAutoJoin(@CurrentActor Actor actor, @Valid @RequestBody AutoJoinRequest request) {
		organizations.letDomainJoin(actor, request.autoJoin());
	}
}
