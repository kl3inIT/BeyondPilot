package ai.genaifund.beyondpilot.proposal;

import java.util.UUID;

import org.springframework.core.io.InputStreamSource;

/** A PDF an application holds, opened for a module that shows it to an operator: the MCP server. */
public record ApplicationFile(UUID id, String name, InputStreamSource content) {
}
