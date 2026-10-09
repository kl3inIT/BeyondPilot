package ai.genaifund.beyondpilot.mcp.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "McpSwitchRequest")
public record McpSwitchRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean enabled) {
}
