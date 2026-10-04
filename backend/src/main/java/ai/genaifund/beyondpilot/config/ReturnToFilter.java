package ai.genaifund.beyondpilot.config;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.jspecify.annotations.Nullable;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Remembers where a person was when they chose a provider, so {@link ReturnToSuccessHandler} can send them back after
 * the round trip. Only a path of this origin is kept, judged the way a browser reads it (no backslash, tab, line
 * break or space).
 */
class ReturnToFilter extends OncePerRequestFilter {

	static final String SESSION_ATTRIBUTE = ReturnToFilter.class.getName() + ".returnTo";

	private static final String AUTHORIZATION_PATH = "/oauth2/authorization/";
	private static final int MAX_LENGTH = 2000;

	static boolean isLocalPath(@Nullable String path) {
		return path != null && path.length() <= MAX_LENGTH && path.startsWith("/") && !path.startsWith("//")
				&& !path.contains("\\")
				&& path.chars().noneMatch(character -> Character.isISOControl(character) || Character.isWhitespace(character));
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		if (request.getRequestURI().startsWith(request.getContextPath() + AUTHORIZATION_PATH)) {
			String returnTo = request.getParameter("returnTo");
			if (isLocalPath(returnTo)) {
				request.getSession().setAttribute(SESSION_ATTRIBUTE, returnTo);
			}
		}
		chain.doFilter(request, response);
	}
}
