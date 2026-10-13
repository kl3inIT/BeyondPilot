package ai.genaifund.beyondpilot.talent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "MyTalent", description = "The caller's talent profile.")
public record MyTalentResponse(
		@Schema(oneOf = TalentProfileResponse.class, types = { "object", "null" },
				description = "Null until the caller saves a profile.") @Nullable TalentProfileResponse profile) {
}
