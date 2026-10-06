package ai.genaifund.beyondpilot.config;

import java.io.IOException;
import java.util.Set;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Refuses a state-changing request that does not carry {@code X-BeyondPilot-CSRF: 1}. A page of another origin cannot
 * add the header without a preflight this application never approves, and a plain form cannot add it at all
 * (docs/conventions.md › Published API contracts).
 */
class CsrfHeaderFilter extends OncePerRequestFilter {

	static final String HEADER = "X-BeyondPilot-CSRF";

	private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE");

	/**
	 * Where an email provider posts its reports. The provider cannot send the header, and these requests act on no
	 * session: each report is accepted only by its signature.
	 */
	static final String PROVIDER_REPORTS = "/api/notification/email/events/";

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		if (!SAFE_METHODS.contains(request.getMethod()) && !"1".equals(request.getHeader(HEADER))
				&& !request.getRequestURI().startsWith(PROVIDER_REPORTS)) {
			response.sendError(HttpServletResponse.SC_FORBIDDEN);
			return;
		}
		chain.doFilter(request, response);
	}
}
