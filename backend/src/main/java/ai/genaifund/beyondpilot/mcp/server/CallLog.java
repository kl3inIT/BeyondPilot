package ai.genaifund.beyondpilot.mcp.server;

import java.time.Instant;
import java.util.function.BiFunction;

import ai.genaifund.beyondpilot.identity.McpCaller;
import ai.genaifund.beyondpilot.mcp.persistence.McpCallRepository;
import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.server.McpStatelessServerFeatures.SyncToolSpecification;
import io.modelcontextprotocol.spec.McpSchema.CallToolRequest;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Records every tool call: who, through which app, which tool, how it ended, how long it took, and the one record it
 * read when it read one (BEY-222). Never the arguments or the result, which can hold what a person searched for or
 * read. A tool that breaks answers with a short error and is logged by its type only. The log is kept for the
 * retention and then deleted.
 */
@Component
class CallLog {

	/** The key under which the transport puts the caller for the tools. */
	static final String CALLER = "beyondpilot.caller";

	private static final Logger LOG = LoggerFactory.getLogger(CallLog.class);

	/**
	 * The record the running call read. The servers run each call on the request's own thread
	 * ({@code immediateExecution}), so a tool names it here and the log reads it back once the tool returns.
	 */
	private static final ThreadLocal<McpCallRepository.@Nullable Target> READ = new ThreadLocal<>();

	/**
	 * Names the record the running call read, to show and link in the activity.
	 * @param kind what it is, such as {@code application}
	 * @param label its name as it reads now
	 * @param path its admin page, from the site's root, or null when it has none
	 */
	static void read(String kind, Object id, String label, @Nullable String path) {
		String name = label.strip();
		READ.set(new McpCallRepository.Target(kind, id.toString(),
				name.length() > 300 ? name.substring(0, 300) : name, path));
	}

	private final McpCallRepository calls;

	private final McpSettings settings;

	CallLog(McpCallRepository calls, McpSettings settings) {
		this.calls = calls;
		this.settings = settings;
	}

	/** The tool, logged on {@code server} ({@code user} or {@code operator}). */
	SyncToolSpecification logged(String server, SyncToolSpecification tool) {
		BiFunction<McpTransportContext, CallToolRequest, CallToolResult> handler = tool.callHandler();
		return new SyncToolSpecification(tool.tool(), (context, request) -> {
			McpCaller caller = (McpCaller) context.get(CALLER);
			Instant started = Instant.now();
			String outcome = "failed";
			READ.remove();
			try {
				CallToolResult result = handler.apply(context, request);
				outcome = Boolean.TRUE.equals(result.isError()) ? "refused" : "ok";
				return result;
			}
			catch (RuntimeException failure) {
				LOG.atError()
					.addKeyValue("event", "mcp.tool_failed")
					.addKeyValue("tool", tool.tool().name())
					.addKeyValue("error_type", failure.getClass().getName())
					.log("An MCP tool failed");
				return CallToolResult.builder().addTextContent("The tool failed; try again later.").isError(true).build();
			}
			finally {
				// A refused or failed call read nothing, whatever it named before it stopped.
				McpCallRepository.Target target = outcome.equals("ok") ? READ.get() : null;
				READ.remove();
				if (caller != null) {
					int duration = (int) Math.min(Integer.MAX_VALUE, Instant.now().toEpochMilli() - started.toEpochMilli());
					calls.record(new McpCallRepository.Call(started, caller.accountId(), caller.clientId(), server,
							tool.tool().name(), outcome, duration, target));
				}
			}
		});
	}

	@Scheduled(cron = "0 30 4 * * *", zone = "Asia/Ho_Chi_Minh")
	void deleteOld() {
		int deleted = calls.deleteBefore(Instant.now().minus(settings.callRetention()));
		LOG.atInfo()
			.addKeyValue("event", "mcp.calls_deleted")
			.addKeyValue("rows", deleted)
			.log("Old MCP calls were deleted");
	}

}
