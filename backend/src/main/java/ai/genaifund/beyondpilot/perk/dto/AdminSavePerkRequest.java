package ai.genaifund.beyondpilot.perk.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminSavePerk", description = "A perk as an operator's form holds it.")
public record AdminSavePerkRequest(
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The organization that gives it; read when it is created only.") @Nullable UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Valid SavePerkRequest perk,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "True when GenAI Fund arranged it, which its card marks.") boolean fromGenAiFund,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The programs whose page shows it beside the perks for their teams.") @NotNull @Size(
				max = 20) List<@NotNull UUID> shownOnProgramIds) {
}
