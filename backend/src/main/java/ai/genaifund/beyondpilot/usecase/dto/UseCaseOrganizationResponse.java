package ai.genaifund.beyondpilot.usecase.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "UseCaseOrganization", description = "The organization a use case is for.")
public record UseCaseOrganizationResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" },
				description = "Its logo, read at /api/storage/files/{id}; null for none.") @Nullable UUID logoFileId) {
}
