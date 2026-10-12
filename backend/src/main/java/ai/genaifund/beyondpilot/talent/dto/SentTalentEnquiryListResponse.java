package ai.genaifund.beyondpilot.talent.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SentTalentEnquiryList", description = "The messages the caller sent through talent profiles.")
public record SentTalentEnquiryListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Those that wait for an answer first, then the newest.") List<SentTalentEnquiryResponse> items) {
}
