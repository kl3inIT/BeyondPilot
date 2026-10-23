package ai.genaifund.beyondpilot.perk.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "PerkSolution", description = "A solution a perk goes with.")
public record PerkSolutionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug) {
}
