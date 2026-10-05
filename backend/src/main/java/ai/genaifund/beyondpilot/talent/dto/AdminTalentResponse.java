package ai.genaifund.beyondpilot.talent.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminTalent", description = "A talent profile as an operator reviews it.")
public record AdminTalentResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) TalentProfileResponse profile,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of the account the profile belongs to.") String email) {
}
