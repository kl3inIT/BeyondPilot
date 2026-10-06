package ai.genaifund.beyondpilot.talent.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "MyTalent", description = "The caller's talent profile and the messages sent through it.")
public record MyTalentResponse(
		@Schema(oneOf = TalentProfileResponse.class, types = { "object", "null" },
				description = "Null until the caller saves a profile.") @Nullable TalentProfileResponse profile,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Those that wait for an answer first, then the newest.") List<TalentEnquiryResponse> enquiries) {
}
