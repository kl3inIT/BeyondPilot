package ai.genaifund.beyondpilot.identity.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AllowOtherHostsRequest")
public record AllowOtherHostsRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
		description = "Whether apps of hosts not reviewed may connect.") boolean allowed) {
}
