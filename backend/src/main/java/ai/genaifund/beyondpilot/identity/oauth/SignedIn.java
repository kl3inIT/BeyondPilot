package ai.genaifund.beyondpilot.identity.oauth;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.signin.AccountOidcUser;
import ai.genaifund.beyondpilot.identity.signin.AccountUserDetails;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.Authentication;

/** The account behind a session, whichever way the person signed in. */
final class SignedIn {

	private SignedIn() {
	}

	static @Nullable Actor actorOf(@Nullable Authentication authentication) {
		return switch (authentication == null ? null : authentication.getPrincipal()) {
			case AccountUserDetails details -> details.getActor();
			case AccountOidcUser user -> user.getActor();
			case null, default -> null;
		};
	}

}
