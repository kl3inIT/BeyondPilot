package ai.genaifund.beyondpilot.organization.dto;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "MergeNotice",
		description = "The organization GenAI Fund merged into the caller's, which they see until they dismiss it.")
public record MergeNoticeResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Its former address, which now leads to the caller's organization.") String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant mergedAt) {
}
