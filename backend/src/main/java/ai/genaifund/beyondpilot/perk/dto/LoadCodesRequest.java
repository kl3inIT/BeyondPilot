package ai.genaifund.beyondpilot.perk.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

@Schema(name = "LoadCodes", description = "Single-use codes for a perk given as a list, one to each claim.")
public record LoadCodesRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The codes; one the perk already holds is skipped.") @NotEmpty @Size(
		max = PerkCodes.MAX_CODES) List<@NotBlank @Size(max = 200) String> codes) {
}
