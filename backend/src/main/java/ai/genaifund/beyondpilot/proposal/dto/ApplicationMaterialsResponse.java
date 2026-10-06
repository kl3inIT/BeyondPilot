package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ApplicationStart",
		description = "What the person's latest other application held, for a new one to start from.")
public record ApplicationMaterialsResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ContactDetails contact,
		@Schema(types = { "object", "null" }) @Nullable AttachedFileResponse deck,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> builtWith,
		@Schema(types = { "string", "null" }) @Nullable String traction) {
}
