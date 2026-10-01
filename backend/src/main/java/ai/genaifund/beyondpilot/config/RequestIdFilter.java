package ai.genaifund.beyondpilot.config;

import java.io.IOException;
import java.util.UUID;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.jspecify.annotations.Nullable;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Gives every request an identifier that appears in its log lines (`request_id`), in the `X-Request-Id` response
 * header and in any problem response, so a person reporting a failure can quote it.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class RequestIdFilter extends OncePerRequestFilter {

	static final String HEADER = "X-Request-Id";
	private static final String ATTRIBUTE = RequestIdFilter.class.getName() + ".requestId";
	private static final String MDC_KEY = "request_id";

	static @Nullable String requestId(HttpServletRequest request) {
		return request.getAttribute(ATTRIBUTE) instanceof String id ? id : null;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String requestId = UUID.randomUUID().toString();
		request.setAttribute(ATTRIBUTE, requestId);
		response.setHeader(HEADER, requestId);
		MDC.put(MDC_KEY, requestId);
		try {
			chain.doFilter(request, response);
		}
		finally {
			MDC.remove(MDC_KEY);
		}
	}
}
