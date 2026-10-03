package ai.genaifund.beyondpilot.identity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/**
 * The signed-in account behind a request. It carries only the account's identifier, so a role or status changed after
 * sign-in is always read from the database, never from the session.
 */
public record Actor(UUID accountId) implements Serializable {

	public Actor {
		Objects.requireNonNull(accountId, "accountId must not be null");
	}
}
