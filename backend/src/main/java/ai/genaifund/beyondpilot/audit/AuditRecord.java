package ai.genaifund.beyondpilot.audit;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One event on its way to the record. The names are those of the moment: a later rename or removal must not rewrite
 * what happened, so the caller passes them and they are stored with the event.
 *
 * @param actor who did it; null when the server configuration did
 * @param resource what it was done to
 * @param details the fields the action declares, and no other
 */
public record AuditRecord(AuditAction action, @Nullable Actor actor, Resource resource, Map<String, String> details) {

	public AuditRecord {
		Objects.requireNonNull(action, "action must not be null");
		Objects.requireNonNull(resource, "resource must not be null");
		details = Map.copyOf(details);
		for (String field : details.keySet()) {
			if (!action.detailFields().contains(field)) {
				throw new IllegalArgumentException(
						"The audit action " + action.value() + " declares no detail named " + field);
			}
		}
	}

	/** The person who acted, as they were named at that moment. */
	public record Actor(UUID id, String label, String email) {

		public Actor {
			Objects.requireNonNull(id, "id must not be null");
			Objects.requireNonNull(label, "label must not be null");
			Objects.requireNonNull(email, "email must not be null");
		}

	}

	/** What was acted on: its kind, its identifier and the name it had at that moment. */
	public record Resource(String type, String id, String label) {

		public Resource {
			Objects.requireNonNull(type, "type must not be null");
			Objects.requireNonNull(id, "id must not be null");
			Objects.requireNonNull(label, "label must not be null");
		}

	}

}
