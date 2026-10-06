package ai.genaifund.beyondpilot.talent.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminTalentEnquiryList", description = "One page of the reported messages, the newest first.")
public record AdminTalentEnquiryListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AdminTalentEnquiryResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long total) {
}
