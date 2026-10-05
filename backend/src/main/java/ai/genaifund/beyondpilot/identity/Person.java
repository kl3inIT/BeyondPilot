package ai.genaifund.beyondpilot.identity;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * An account as another module needs it to name a person or to act on the address they proved by signing in.
 * @param email the address as the person wrote it
 * @param displayName null until the person or their provider gives one
 */
public record Person(UUID accountId, String email, @Nullable String displayName) {

	/** The name a person is shown by: their name, or their address until they have one. */
	public String label() {
		return displayName != null ? displayName : email;
	}
}
