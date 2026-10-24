package ai.genaifund.beyondpilot.usecase.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "UseCasePreview", description = "The read-only link to a use case that is not public.")
public record UseCasePreviewResponse(
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The key the link ends with, at /use-cases/preview/{token}; null while the link is off.") @Nullable UUID token) {
}
