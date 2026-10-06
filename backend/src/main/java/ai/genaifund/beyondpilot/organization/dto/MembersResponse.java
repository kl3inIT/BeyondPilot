package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "OrganizationMembers",
		description = "Who belongs to an organization, owners first. Invitations and requests are empty, and the allowance null, for a caller who is not an owner.")
public record MembersResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MemberResponse> members,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<InvitationResponse> invitations,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<JoinRequestResponse> requests,
		@Schema(types = { "object", "null" }) @Nullable InvitationAllowanceResponse allowance) {
}
