package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "InviteMember", description = "An address asked to join the caller's organization.")
public record InviteMemberRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Email @Size(max = 254) String email,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "owner", "member" }) @NotNull @Pattern(
				regexp = OrganizationCodes.MEMBER_ROLE) String role) {
}
