package ai.genaifund.beyondpilot.audit;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One page of the audit log, newest first, for a module that shows it outside the admin screen.
 * @param older the cursor of the page towards the past; null on the oldest page
 */
public record AuditEvents(List<Event> items, @Nullable String older) {

	/**
	 * One recorded change: who did what to what, and when, with the names they had at that moment.
	 * @param actorName who did it; null with {@code actorEmail} when the server configuration did
	 * @param details the fields the action declares, each as text
	 * @param requestId the request that made the change, as logged
	 */
	public record Event(Instant occurredAt, String action, @Nullable String actorName, @Nullable String actorEmail,
			String resourceType, String resourceId, String resourceLabel, Map<String, String> details,
			@Nullable UUID requestId) {
	}

}
