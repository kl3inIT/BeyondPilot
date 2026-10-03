package ai.genaifund.beyondpilot.identity.signin;

import java.util.List;

import ai.genaifund.beyondpilot.identity.Actor;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;

/** The principal of a session opened with Google, named by the account like every other session. */
public final class AccountOidcUser extends DefaultOidcUser {

	private static final long serialVersionUID = 1L;

	private final Actor actor;

	AccountOidcUser(Actor actor, OidcIdToken idToken) {
		super(List.of(), idToken);
		this.actor = actor;
	}

	public Actor getActor() {
		return actor;
	}

	@Override
	public String getName() {
		return actor.accountId().toString();
	}
}
