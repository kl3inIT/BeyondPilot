package ai.genaifund.beyondpilot.messaging.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ReportedRequestList", description = "One page of the reported first messages, the newest first.")
public record ReportedRequestListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ReportedRequestResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long total) {
}
