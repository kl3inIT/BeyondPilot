package ai.genaifund.beyondpilot.mcp.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.mcp.McpActivity;
import ai.genaifund.beyondpilot.mcp.McpAdministration;
import ai.genaifund.beyondpilot.mcp.dto.McpCallListRequest;
import ai.genaifund.beyondpilot.mcp.dto.McpCallListResponse;
import ai.genaifund.beyondpilot.mcp.dto.McpSettingsResponse;
import ai.genaifund.beyondpilot.mcp.dto.McpSwitchRequest;
import io.swagger.v3.oas.annotations.Operation;
import org.springdoc.core.annotations.ParameterObject;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mcp/admin")
@Tag(name = "MCP", description = "The MCP servers AI apps reach BeyondPilot through.")
class McpAdminController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final McpAdministration administration;

	private final McpActivity activity;

	McpAdminController(McpAdministration administration, McpActivity activity) {
		this.administration = administration;
		this.activity = activity;
	}

	@GetMapping(path = "/calls", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listMcpCalls", summary = "The calls AI apps made to the MCP servers",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of calls, newest first.")
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	McpCallListResponse calls(@CurrentActor Actor actor, @Valid @ParameterObject McpCallListRequest request) {
		return activity.calls(actor, request);
	}

	@GetMapping(path = "/settings", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "getMcpSettings", summary = "The MCP servers, their switches and their tools",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "The settings.")
	@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	McpSettingsResponse settings(@CurrentActor Actor actor) {
		return administration.settings(actor);
	}

	@PutMapping("/user-server")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "switchMcpUserServer", summary = "Turn the user MCP server on or off",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "Saved.", content = @Content)
	void userServer(@CurrentActor Actor actor, @RequestBody McpSwitchRequest request) {
		administration.userServer(actor, request.enabled());
	}

	@PutMapping("/tools/{server}/{tool}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	@Operation(operationId = "switchMcpTool", summary = "Turn a tool of an MCP server on or off",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "204", description = "Saved.", content = @Content)
	@ApiResponse(responseCode = "404", description = "That server has no such tool.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	void tool(@CurrentActor Actor actor, @PathVariable String server, @PathVariable String tool,
			@RequestBody McpSwitchRequest request) {
		administration.tool(actor, server, tool, request.enabled());
	}

}
