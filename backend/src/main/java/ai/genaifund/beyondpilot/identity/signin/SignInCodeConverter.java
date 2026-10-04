package ai.genaifund.beyondpilot.identity.signin;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import org.jspecify.annotations.Nullable;
import org.springframework.security.authentication.ott.OneTimeTokenAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationConverter;
import org.springframework.stereotype.Component;

/**
 * Reads a typed sign-in code. The code comes from the form; the challenge it belongs to comes from the session, never
 * from the request, which is what ties a code to the browser that asked for it.
 */
@Component
class SignInCodeConverter implements AuthenticationConverter {

	static final char SEPARATOR = ':';

	@Override
	public @Nullable Authentication convert(HttpServletRequest request) {
		String code = request.getParameter("code");
		if (code == null) {
			return null;
		}
		HttpSession session = request.getSession(false);
		Object challenge = session == null ? null : session.getAttribute(SignInCodeSender.CHALLENGE_ATTRIBUTE);
		// Spring Security's token carries one string: the challenge and the code travel in it together.
		return new OneTimeTokenAuthenticationToken((challenge instanceof String id ? id : "") + SEPARATOR + code.strip());
	}
}
