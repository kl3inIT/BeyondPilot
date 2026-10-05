package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Schema(name = "ChangeMemberRole")
public record ChangeMemberRoleRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "owner", "member" }) @NotNull @Pattern(
				regexp = OrganizationCodes.MEMBER_ROLE) String role) {
}
