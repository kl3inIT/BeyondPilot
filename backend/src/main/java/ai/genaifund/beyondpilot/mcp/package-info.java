/**
 * BeyondPilot's MCP servers (BEY-78): how AI apps people connect reach it. {@code /mcp} lets every signed-in person's
 * app search and read what BeyondPilot publishes. A delivery channel over other modules' published services, like the
 * web controllers: it owns only the servers, their tools and the log of calls. Who may call is identity's.
 */
@ApplicationModule(displayName = "MCP", type = ApplicationModule.Type.CLOSED,
		allowedDependencies = { "identity", "program", "search", "solution" })
@NullMarked
package ai.genaifund.beyondpilot.mcp;

import org.jspecify.annotations.NullMarked;
import org.springframework.modulith.ApplicationModule;
