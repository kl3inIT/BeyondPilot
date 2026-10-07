package ai.genaifund.beyondpilot.notification.delivery;

import java.util.Objects;
import java.util.UUID;

/**
 * A message was queued in the transaction that just committed. Its handler is recorded by Spring Modulith's event
 * publication registry, so a delivery that never ran is run again on the next start; the queue itself keeps the
 * retries. It carries the message's identifier only.
 */
public record EmailQueued(UUID messageId) {

	public EmailQueued {
		Objects.requireNonNull(messageId, "messageId must not be null");
	}

}
