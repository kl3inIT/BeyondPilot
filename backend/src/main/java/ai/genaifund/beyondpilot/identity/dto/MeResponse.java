package ai.genaifund.beyondpilot.identity.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Me", description = "The signed-in account.")
public record MeResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
		@Schema(types = { "string", "null" },
				description = "The name the account shows; null until the person or their provider gives one.") @Nullable String displayName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "user", "operator" },
				description = "`operator` is GenAI Fund staff.") String role) {
}
