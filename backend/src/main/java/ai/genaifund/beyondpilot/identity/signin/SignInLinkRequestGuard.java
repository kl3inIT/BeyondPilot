package ai.genaifund.beyondpilot.identity.signin;

import java.io.IOException;
import java.time.Instant;
import java.util.regex.Pattern;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import ai.genaifund.beyondpilot.identity.IdentityProperties;
import ai.genaifund.beyondpilot.identity.persistence.SignInLinkQueryRepository;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Stands in front of Spring Security's link request, which stores a token for whatever it is given. Nothing is stored
 * and nothing is sent for a value that is not a plain address, or for an address that already holds its share of
 * working links.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 100)
class SignInLinkRequestGuard extends OncePerRequestFilter {

	private static final Logger LOG = LoggerFactory.getLogger(SignInLinkRequestGuard.class);

	/** Spring Security's default address for generating a one-time token. */
	private static final String LINK_REQUEST_PATH = "/ott/generate";

	/**
	 * Deliberately narrower than the address grammar: only characters that every mail parser reads the same way, so no
	 * value means one address here and another to the mail library.
	 */
	private static final Pattern ADDRESS = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)+");
	private static final int MAX_ADDRESS_LENGTH = 320;

	private final SignInLinkQueryRepository links;
	private final IdentityProperties properties;

	SignInLinkRequestGuard(SignInLinkQueryRepository links, IdentityProperties properties) {
		this.links = links;
		this.properties = properties;
	}

	static boolean isAddress(@Nullable String value) {
		return value != null && value.length() <= MAX_ADDRESS_LENGTH && ADDRESS.matcher(value).matches();
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !("POST".equals(request.getMethod())
				&& request.getRequestURI().equals(request.getContextPath() + LINK_REQUEST_PATH));
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String address = request.getParameter("username");
		if (!isAddress(address)) {
			response.sendError(HttpServletResponse.SC_BAD_REQUEST);
			return;
		}
		if (links.countUnexpired(address, Instant.now()) >= properties.signInLinkLimit()) {
			LOG.atWarn().addKeyValue("event", "identity.sign_in_link.limited").log("Sign-in link limit reached");
			// Room for another link opens when the oldest one expires, at the latest after one lifetime.
			response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(properties.signInLinkLifetime().toSeconds()));
			response.sendError(429);
			return;
		}
		chain.doFilter(request, response);
	}
}
