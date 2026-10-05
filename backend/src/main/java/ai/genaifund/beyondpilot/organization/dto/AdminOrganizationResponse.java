package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminOrganization", description = "One organization as an operator reviews it.")
public record AdminOrganizationResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) OrganizationResponse organization,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Who created it, as they are shown.") String createdBy,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String createdByEmail,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MemberResponse> members,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<InvitationResponse> invitations,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The open requests to own it; empty for an owned organization.") List<JoinRequestResponse> claims) {
}
