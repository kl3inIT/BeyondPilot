package ai.genaifund.beyondpilot.mcp.server;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import io.modelcontextprotocol.spec.ProtocolVersions;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** The checks every call to an MCP server passes before a tool sees it. */
final class McpCallFilters {

	/** The protocol versions the MCP Java SDK 2.0.1 speaks; the default list of its stateless transport. */
	static final List<String> PROTOCOL_VERSIONS = List.of(ProtocolVersions.MCP_2025_03_26,
			ProtocolVersions.MCP_2025_06_18, ProtocolVersions.MCP_2025_11_25);

	private McpCallFilters() {
	}

	/**
	 * Refuses a request body larger than allowed, whether it says its length or streams it, before anything reads it
	 * whole.
	 */
	static final class BodyLimit extends OncePerRequestFilter {

		private final int maxBytes;

		BodyLimit(int maxBytes) {
			this.maxBytes = maxBytes;
		}

		@Override
		protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
				throws ServletException, IOException {
			if (request.getContentLengthLong() > maxBytes) {
				response.sendError(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
				return;
			}
			chain.doFilter(new Bounded(request, maxBytes), response);
		}

		private static final class Bounded extends HttpServletRequestWrapper {

			private final int maxBytes;

			Bounded(HttpServletRequest request, int maxBytes) {
				super(request);
				this.maxBytes = maxBytes;
			}

			@Override
			public ServletInputStream getInputStream() throws IOException {
				ServletInputStream in = super.getInputStream();
				return new ServletInputStream() {

					private long read;

					@Override
					public int read() throws IOException {
						int b = in.read();
						if (b >= 0 && ++read > maxBytes) {
							throw new IOException("The request body is larger than allowed");
						}
						return b;
					}

					@Override
					public int read(byte[] buffer, int offset, int length) throws IOException {
						int count = in.read(buffer, offset, length);
						if (count > 0 && (read += count) > maxBytes) {
							throw new IOException("The request body is larger than allowed");
						}
						return count;
					}

					@Override
					public boolean isFinished() {
						return in.isFinished();
					}

					@Override
					public boolean isReady() {
						return in.isReady();
					}

					@Override
					public void setReadListener(ReadListener listener) {
						in.setReadListener(listener);
					}

				};
			}

		}

	}

	/** Answers 404 for the user server while operators have it switched off; the operators' server has no switch. */
	static final class UserServerSwitch extends OncePerRequestFilter {

		private final McpSwitches switches;

		UserServerSwitch(McpSwitches switches) {
			this.switches = switches;
		}

		@Override
		protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
				throws ServletException, IOException {
			String path = request.getRequestURI().substring(request.getContextPath().length());
			if (path.equals("/mcp") && !switches.isUserServerOn()) {
				response.sendError(HttpServletResponse.SC_NOT_FOUND);
				return;
			}
			chain.doFilter(request, response);
		}

	}

	/**
	 * Answers a protocol version the server does not speak with 400 and JSON-RPC error -32000, so a client on a later
	 * version falls back to one it shares. A request without the header is taken as 2025-03-26, as the specification
	 * says.
	 */
	static final class ProtocolVersion extends OncePerRequestFilter {

		static final String HEADER = "MCP-Protocol-Version";

		@Override
		protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
				throws ServletException, IOException {
			String version = request.getHeader(HEADER);
			if (version != null && !PROTOCOL_VERSIONS.contains(version)) {
				response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
				response.setContentType(MediaType.APPLICATION_JSON_VALUE);
				response.getWriter()
					.write("{\"jsonrpc\":\"2.0\",\"id\":null,\"error\":{\"code\":-32000,"
							+ "\"message\":\"Unsupported protocol version; supported: " + String.join(", ", PROTOCOL_VERSIONS)
							+ "\"}}");
				return;
			}
			chain.doFilter(request, response);
		}

	}

	/**
	 * Limits calls per minute for each person through each app, and for everyone together. Runs after the caller is
	 * known; a refusal says when to retry.
	 */
	static final class CallLimits extends OncePerRequestFilter {

		private final McpSettings settings;

		private final Bucket everyone;

		private final Cache<String, Bucket> callers = Caffeine.newBuilder()
			.maximumSize(10_000)
			.expireAfterAccess(Duration.ofMinutes(15))
			.build();

		CallLimits(McpSettings settings) {
			this.settings = settings;
			this.everyone = perMinute(settings.callsPerMinute());
		}

		private static Bucket perMinute(int limit) {
			return Bucket.builder()
				.addLimit(Bandwidth.builder().capacity(limit).refillGreedy(limit, Duration.ofMinutes(1)).build())
				.build();
		}

		@Override
		protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
				throws ServletException, IOException {
			if (!(SecurityContextHolder.getContext().getAuthentication() instanceof CallerAuthentication call)) {
				chain.doFilter(request, response);
				return;
			}
			String key = call.caller().accountId() + " " + call.caller().clientId();
			Bucket own = callers.get(key, ignored -> perMinute(settings.callsPerCallerPerMinute()));
			ConsumptionProbe probe = own.tryConsumeAndReturnRemaining(1);
			if (!probe.isConsumed() || !everyone.tryConsume(1)) {
				long seconds = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()));
				response.setHeader("Retry-After", Long.toString(probe.isConsumed() ? 1 : seconds));
				response.sendError(429);
				return;
			}
			chain.doFilter(request, response);
		}

	}

}
