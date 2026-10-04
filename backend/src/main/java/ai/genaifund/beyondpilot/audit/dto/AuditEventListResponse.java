package ai.genaifund.beyondpilot.audit.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AuditEventList", description = "One page of audit events, newest first.")
public record AuditEventListResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AuditEventResponse> items,
		@Schema(types = { "string", "null" },
				description = "Pass as `after` for the page towards the present; null on the newest page.") @Nullable String newer,
		@Schema(types = { "string", "null" },
				description = "Pass as `before` for the page towards the past; null on the oldest page.") @Nullable String older) {
}
