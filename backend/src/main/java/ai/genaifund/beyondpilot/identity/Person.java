package ai.genaifund.beyondpilot.identity;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * An account as another module needs it to name a person or to act on the address they proved by signing in.
 * @param email the address as the person wrote it
 * @param displayName null until the person or their provider gives one
 * @param country ISO 3166-1 alpha-2; null until the person says where they are
 * @param phone with its country code; null until the person gives a number
 */
public record Person(UUID accountId, String email, @Nullable String displayName, @Nullable String country,
		@Nullable String phone) {

	/** The name a person is shown by: their name, or their address until they have one. */
	public String label() {
		return displayName != null ? displayName : email;
	}
}
