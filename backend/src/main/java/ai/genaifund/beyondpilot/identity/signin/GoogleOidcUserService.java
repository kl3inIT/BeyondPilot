package ai.genaifund.beyondpilot.identity.signin;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityException;
import ai.genaifund.beyondpilot.identity.IdentityService;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

/** Turns a Google sign-in into a session of the matching account. */
@Component
class GoogleOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {

	private final OidcUserService delegate = new OidcUserService();
	private final IdentityService identity;

	GoogleOidcUserService(IdentityService identity) {
		this.identity = identity;
	}

	@Override
	public OidcUser loadUser(OidcUserRequest request) {
		OidcUser google = delegate.loadUser(request);
		String email = google.getEmail();
		if (email == null || email.isBlank()) {
			throw new OAuth2AuthenticationException(new OAuth2Error("email_missing"));
		}
		try {
			Actor actor = identity.signInWithGoogle(google.getSubject(), email,
					Boolean.TRUE.equals(google.getEmailVerified()), google.getFullName());
			return new AccountOidcUser(actor, google.getIdToken());
		}
		catch (IdentityException exception) {
			throw new OAuth2AuthenticationException(new OAuth2Error(exception.code()), exception);
		}
	}
}
