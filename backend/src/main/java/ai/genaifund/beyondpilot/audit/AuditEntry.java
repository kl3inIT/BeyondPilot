package ai.genaifund.beyondpilot.audit;

import java.time.Instant;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * One event of a resource's history, as {@link AuditLog#history} reads it for a module that shows it beside the
 * resource.
 * @param action the action's stored name, such as {@code solution.approve}
 * @param actor who did it, as they were named then; null when the server configuration did
 * @param details the fields the action declares, each as text
 */
public record AuditEntry(Instant occurredAt, String action, @Nullable String actor, Map<String, String> details) {

	public AuditEntry {
		details = Map.copyOf(details);
	}

}
