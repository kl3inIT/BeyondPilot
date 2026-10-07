package ai.genaifund.beyondpilot.notification.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EmailMessageList", description = "One page of the email log, newest first, with the counts of the period.")
public record EmailMessageListResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<EmailMessageSummaryResponse> items,
		@Schema(types = { "string", "null" }, description = "Pass as `after` for the page towards the present.") @Nullable String newer,
		@Schema(types = { "string", "null" }, description = "Pass as `before` for the page towards the past.") @Nullable String older,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Counts counts) {

	@Schema(name = "EmailCounts", description = "What became of the emails of the period, filtered by kind but not by state or search.")
	public record Counts(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) long total, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long sent, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long delivered, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long bounced, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long complained,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Failed or skipped.") long notSent) {
	}

}
