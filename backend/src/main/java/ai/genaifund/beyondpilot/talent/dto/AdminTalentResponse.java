package ai.genaifund.beyondpilot.talent.dto;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminTalent", description = "A talent profile as an operator reviews it.")
public record AdminTalentResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) TalentProfileResponse profile,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of the account the profile belongs to.") String email,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When an operator pinned it to the top of the public directory; null while it is not "
						+ "pinned.") @Nullable Instant pinnedAt) {
}
