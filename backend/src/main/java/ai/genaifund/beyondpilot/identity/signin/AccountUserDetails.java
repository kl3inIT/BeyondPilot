package ai.genaifund.beyondpilot.identity.signin;

import java.util.Collection;
import java.util.List;

import ai.genaifund.beyondpilot.identity.Actor;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * The principal of a session opened with an emailed link. It holds no authority: roles are read from the account when
 * an operation needs them.
 */
public final class AccountUserDetails implements UserDetails {

	private static final long serialVersionUID = 1L;

	private final Actor actor;

	AccountUserDetails(Actor actor) {
		this.actor = actor;
	}

	public Actor getActor() {
		return actor;
	}

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return List.of();
	}

	@Override
	public @Nullable String getPassword() {
		return null;
	}

	@Override
	public String getUsername() {
		return actor.accountId().toString();
	}
}
