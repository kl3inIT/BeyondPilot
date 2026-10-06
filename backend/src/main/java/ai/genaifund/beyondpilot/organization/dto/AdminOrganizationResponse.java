package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminOrganization", description = "One organization as an operator reviews it.")
public record AdminOrganizationResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) OrganizationResponse organization,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Who created it, as they are shown.") String createdBy,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String createdByEmail,
		@Schema(types = { "string", "null" },
				description = "A domain the operator may verify with a decision: the one it has, else the creator's work domain while it waits for review, else its website's. Null when another organization holds it.") @Nullable String suggestedDomain,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MemberResponse> members,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<InvitationResponse> invitations,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The open requests to own it; empty for an owned organization.") List<JoinRequestResponse> claims) {
}
