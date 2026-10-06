package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "OrganizationMembers",
		description = "One page of who belongs to an organization, owners first. Invitations and requests, all of them, are empty, and the allowance null, for a caller who is not an owner.")
public record MembersResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MemberResponse> members,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The page of members returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many members the organization has, over all pages.") long total,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<InvitationResponse> invitations,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<JoinRequestResponse> requests,
		@Schema(types = { "object", "null" }) @Nullable InvitationAllowanceResponse allowance) {
}
