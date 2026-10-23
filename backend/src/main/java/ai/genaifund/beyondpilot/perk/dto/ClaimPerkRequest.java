package ai.genaifund.beyondpilot.perk.dto;

import java.util.Map;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(name = "ClaimPerk", description = "What a person sends to get a perk: for a request, the answers to its questions.")
public record ClaimPerkRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
		description = "The answers by question identifier; empty for any other perk.") @NotNull @Size(
				max = PerkCodes.MAX_QUESTIONS) Map<String, String> answers) {
}
