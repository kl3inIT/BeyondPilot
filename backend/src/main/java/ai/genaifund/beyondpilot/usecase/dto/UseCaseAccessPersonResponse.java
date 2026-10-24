package ai.genaifund.beyondpilot.usecase.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "UseCaseAccessPerson", description = "One person who may open a use case, and what they may do with it.")
public record UseCaseAccessPersonResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID accountId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Their name, or their address until they have a name.") String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "viewer", "editor", "full_access" }) String role,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether they started the use case. Their access cannot be changed.") boolean creator,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether they own the organization. Their access cannot be changed.") boolean owner,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether it is the caller.") boolean you,
		@Schema(types = { "string", "null" }, description = "Who gave them access; null for the creator and the owners.") @Nullable String addedBy,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant addedAt) {
}
