package ai.genaifund.beyondpilot.identity.signin;

import ai.genaifund.beyondpilot.identity.IdentityException;
import ai.genaifund.beyondpilot.identity.IdentityService;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

/**
 * Called by Spring Security after it has consumed a valid one-time token: the username is the address the link was
 * sent to, which the redemption has just proven.
 */
@Component
class AccountUserDetailsService implements UserDetailsService {

	private final IdentityService identity;

	AccountUserDetailsService(IdentityService identity) {
		this.identity = identity;
	}

	@Override
	public UserDetails loadUserByUsername(String email) {
		try {
			return new AccountUserDetails(identity.signInWithEmail(email));
		}
		catch (IdentityException exception) {
			throw new DisabledException(exception.code(), exception);
		}
	}
}
