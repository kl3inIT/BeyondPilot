package ai.genaifund.beyondpilot.notification.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "EmailSuppressionList", description = "One page of suppressed addresses, the newest first.")
public record EmailSuppressionListResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<EmailSuppressionResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many addresses match, over all pages.") long total) {
}
