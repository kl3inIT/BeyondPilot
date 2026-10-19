package ai.genaifund.beyondpilot.notification;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One email as it was sent, with what happened to it, for a module that shows it outside the admin screen. A sign-in
 * code holds a code that still signs in for minutes, so neither its subject nor its body is given.
 * @param html the body as sent; null for a sign-in code
 * @param text the plain-text body as sent; null for a sign-in code
 * @param suppression why the address is not sent to; null when it is
 */
public record SentEmail(UUID id, Instant createdAt, @Nullable Instant sentAt, String recipient, String kind,
		String subject, @Nullable String html, @Nullable String text, String status, int attempts,
		@Nullable String provider, @Nullable String lastError, List<Event> events, @Nullable Suppression suppression) {

	/**
	 * What the provider reported.
	 * @param type {@code delivered}, {@code bounced}, {@code soft_bounced} or {@code complained}
	 */
	public record Event(String type, Instant occurredAt, @Nullable String detail) {
	}

	/**
	 * Why the address is not sent to.
	 * @param reason {@code bounce}, {@code complaint} or {@code manual}
	 * @param createdBy the operator who added it by hand
	 */
	public record Suppression(String reason, Instant createdAt, @Nullable String createdBy) {
	}

}
