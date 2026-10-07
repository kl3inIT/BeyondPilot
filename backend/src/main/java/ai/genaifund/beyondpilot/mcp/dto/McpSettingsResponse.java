package ai.genaifund.beyondpilot.mcp.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "McpSettings", description = "The MCP servers, their switches and their tools.")
public record McpSettingsResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of the operators' server.") String operatorServerAddress,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of the server every signed-in person may use.") String userServerAddress,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the user server answers; off, it answers 404.") boolean userServerEnabled,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Every tool of both servers, the operators' first.") List<ToolSwitch> tools) {

	@Schema(name = "McpToolSwitch")
	public record ToolSwitch(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "user", "operator" }) String server,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(types = { "string", "null" }) @Nullable String title,
			@Schema(types = { "string", "null" }) @Nullable String description,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "Whether the server lists it and takes calls to it.") boolean enabled) {
	}

}
