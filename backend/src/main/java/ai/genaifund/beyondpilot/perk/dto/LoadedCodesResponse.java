package ai.genaifund.beyondpilot.perk.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "LoadedCodes", description = "What a load of codes did.")
public record LoadedCodesResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many were new.") int added,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many the perk holds.") int loaded,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many are not given yet.") int free) {
}
