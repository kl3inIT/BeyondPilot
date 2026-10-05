package ai.genaifund.beyondpilot.organization.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "OrganizationMember", description = "One person who belongs to an organization.")
public record MemberResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID accountId,
		@Schema(types = { "string", "null" }) @Nullable String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "owner", "member" }) String role,
		@Schema(types = { "string", "null" }) @Nullable String jobTitle,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant joinedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether this is the caller.") boolean self) {
}
