package ai.genaifund.beyondpilot.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;

/** After a provider round trip, returns the person to the page {@link ReturnToFilter} remembered, or to the home page. */
class ReturnToSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

	@Override
	protected String determineTargetUrl(HttpServletRequest request, HttpServletResponse response,
			Authentication authentication) {
		HttpSession session = request.getSession(false);
		if (session != null && session.getAttribute(ReturnToFilter.SESSION_ATTRIBUTE) instanceof String returnTo) {
			session.removeAttribute(ReturnToFilter.SESSION_ATTRIBUTE);
			if (ReturnToFilter.isLocalPath(returnTo)) {
				return returnTo;
			}
		}
		return "/";
	}
}
