package ai.genaifund.beyondpilot.mcp.dto;

import java.time.Instant;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the activity of the MCP servers. Every member is optional. */
public record McpCallListRequest(
		@Parameter(description = "Only calls made at or after this instant.",
				schema = @Schema(type = "string", format = "date-time")) @Nullable Instant from,
		@Parameter(description = "Only calls of the app with this client id.") @Size(max = 500) @Nullable String app,
		@Parameter(description = "Only calls to this tool.") @Size(max = 100) @Nullable String tool,
		@Parameter(description = "Only calls that ended this way.",
				schema = @Schema(allowableValues = { "ok", "refused", "failed" })) @Pattern(
						regexp = "ok|refused|failed") @Nullable String outcome,
		@Parameter(description = "Only calls of people whose name or address contains this, ignoring case.") @Size(
				max = 100) @Nullable String q,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page) {
}
