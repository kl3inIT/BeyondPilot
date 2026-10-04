package ai.genaifund.beyondpilot.identity.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AccountSummary", description = "One account in the operators' list.")
public record AccountSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
		@Schema(types = { "string", "null" },
				description = "The name the account shows; null until the person or their provider gives one.") @Nullable String displayName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "user", "operator" },
				description = "`operator` is GenAI Fund staff.") String role,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "active", "disabled" },
				description = "A disabled account cannot sign in.") String status,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "The last completed sign-in.") @Nullable Instant lastSignInAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The server configuration names this address as an operator, so the role cannot be withdrawn here.") boolean configuredOperator) {
}
