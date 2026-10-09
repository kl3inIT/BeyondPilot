package ai.genaifund.beyondpilot.mcp.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "McpCallList", description = "One page of the calls AI apps made to the MCP servers, newest first.")
public record McpCallListResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Item> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The page returned, counted from 1.") int page,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many calls a page holds.") int pageSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many calls match, over all pages.") long total,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The apps that called in the period, to filter by.") List<App> apps,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The tools of the servers, to filter by.") List<String> tools) {

	@Schema(name = "McpCall")
	public record Item(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date-time") Instant calledAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID accountId,
			@Schema(types = { "string", "null" },
					description = "Null until the person gives a name, or when the account is gone.") @Nullable String personName,
			@Schema(types = { "string", "null" }, description = "Null when the account is gone.") @Nullable String personEmail,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String clientId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String appName,
			@Schema(types = { "string", "null" }) @Nullable String appHost,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "user", "operator" }) String server,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String tool,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "ok", "refused", "failed" },
					description = "`ok`; `refused`, the tool answered with an error such as an unknown id; `failed`, it broke.") String outcome,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int durationMs) {
	}

	@Schema(name = "McpCallApp")
	public record App(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String clientId,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(types = { "string", "null" }) @Nullable String host) {
	}

}
