package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "InvitationAllowance", description = "How many more people an organization's owners may invite now.")
public record InvitationAllowanceResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the organization may invite at all; one that is not approved may not.") boolean open,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many invitations may still be sent in the current 24 hours.") int leftToday,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The most invitations it sends in 24 hours.") int dailyLimit,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many more invitations may wait for an answer at once.") int leftOpen,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The most invitations that wait for an answer at once.") int openLimit) {
}
