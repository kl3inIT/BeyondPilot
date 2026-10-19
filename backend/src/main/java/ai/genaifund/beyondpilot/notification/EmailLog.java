package ai.genaifund.beyondpilot.notification;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One page of the email log, newest first, with what became of the period's email, for a module that shows it outside
 * the admin screen. A sign-in code's subject holds the code, so it is given as {@link #SIGN_IN_CODE_SUBJECT}.
 * @param older the cursor of the page towards the past; null on the oldest page
 */
public record EmailLog(List<Item> items, @Nullable String older, Counts counts) {

	/** The subject a sign-in code is shown by in place of its own. */
	public static final String SIGN_IN_CODE_SUBJECT = "A sign-in code";

	/**
	 * One message.
	 * @param status {@code queued}, {@code sent}, {@code delivered}, {@code bounced}, {@code complained},
	 * {@code failed} or {@code skipped}
	 * @param lastError the typed reason of the last failure
	 */
	public record Item(UUID id, Instant createdAt, String recipient, String kind, String subject, String status,
			int attempts, @Nullable String lastError) {
	}

	/**
	 * What became of the period's email, filtered by kind but not by state or search.
	 * @param notSent failed or skipped
	 */
	public record Counts(long total, long sent, long delivered, long bounced, long complained, long notSent) {
	}

}
