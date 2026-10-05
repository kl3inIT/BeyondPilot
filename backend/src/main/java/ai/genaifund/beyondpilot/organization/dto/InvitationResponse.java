package ai.genaifund.beyondpilot.organization.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "OrganizationInvitation", description = "An open invitation to an organization.")
public record InvitationResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The address that was asked.") String email,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "owner", "member" }) String role,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Who asked, as they are shown.") String invitedBy,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {
}
