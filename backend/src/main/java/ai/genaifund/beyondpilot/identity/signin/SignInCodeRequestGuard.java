package ai.genaifund.beyondpilot.identity.signin;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.regex.Pattern;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Stands in front of Spring Security's code request, which stores a code for whatever it is given. Nothing is stored
 * and nothing is sent for a value that is not a plain address, or for an address that may not have another code
 * yet.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 100)
class SignInCodeRequestGuard extends OncePerRequestFilter {

	private static final Logger LOG = LoggerFactory.getLogger(SignInCodeRequestGuard.class);

	/**
	 * Spring Security's default address for generating a one-time token, matched with Spring Security's own matcher so
	 * that no spelling of the path reaches its filter without passing here.
	 */
	private static final RequestMatcher CODE_REQUEST = PathPatternRequestMatcher.withDefaults()
		.matcher(HttpMethod.POST, "/ott/generate");

	/**
	 * Deliberately narrower than the address grammar: only characters that every mail parser reads the same way, so no
	 * value means one address here and another to the mail library.
	 */
	private static final Pattern ADDRESS = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)+");
	private static final int MAX_ADDRESS_LENGTH = 320;

	private final SignInCodeLimits limits;

	SignInCodeRequestGuard(SignInCodeLimits limits) {
		this.limits = limits;
	}

	static boolean isAddress(@Nullable String value) {
		return value != null && value.length() <= MAX_ADDRESS_LENGTH && ADDRESS.matcher(value).matches();
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !CODE_REQUEST.matches(request);
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String address = request.getParameter("username");
		if (!isAddress(address)) {
			response.sendError(HttpServletResponse.SC_BAD_REQUEST);
			return;
		}
		Instant now = Instant.now();
		Instant refusedUntil = limits.refusedUntil(address, now);
		if (refusedUntil != null) {
			LOG.atWarn().addKeyValue("event", "identity.sign_in_code.limited").log("Sign-in code limit reached");
			long wait = Math.max(1, Duration.between(now, refusedUntil).toSeconds());
			response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(wait));
			response.sendError(429);
			return;
		}
		chain.doFilter(request, response);
	}
}
