package ai.genaifund.beyondpilot.mcp.server;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import ai.genaifund.beyondpilot.identity.McpAudience;
import ai.genaifund.beyondpilot.identity.McpCallRefused;
import ai.genaifund.beyondpilot.identity.McpCallers;
import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.json.jackson3.JacksonMcpJsonMapper;
import io.modelcontextprotocol.server.McpServer;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.server.transport.DefaultServerTransportSecurityValidator;
import io.modelcontextprotocol.spec.McpSchema;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.mcp.server.webmvc.transport.WebMvcStatelessServerTransport;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.server.resource.BearerTokenError;
import org.springframework.security.oauth2.server.resource.BearerTokenErrors;
import org.springframework.security.oauth2.server.resource.authentication.BearerTokenAuthenticationToken;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.ServerResponse;
import tools.jackson.databind.json.JsonMapper;

/**
 * The MCP servers and the chain that guards them, between the authorization server's chain and the application's. A
 * call carries a bearer token and nothing else: no session, no cookie, so no CSRF. Identity checks the token, its
 * connection, the account and, for the operators' server, the role, on every call. A call without a token, or with
 * one that does not work, is answered 401 with where to sign in (RFC 9728), so an app finds its way on its own.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(McpSettings.class)
class McpServerConfiguration {

	private static final Logger LOG = LoggerFactory.getLogger(McpServerConfiguration.class);

	private static final String METADATA = "/.well-known/oauth-protected-resource";

	@Bean
	@Order(2)
	SecurityFilterChain mcpFilterChain(HttpSecurity http, McpCallers callers, McpSettings settings) {
		http.securityMatcher("/mcp", "/mcp/**", METADATA, METADATA + "/**")
			.authorizeHttpRequests(requests -> requests.requestMatchers(METADATA, METADATA + "/**")
				.permitAll()
				.anyRequest()
				.authenticated())
			.csrf(AbstractHttpConfigurer::disable)
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.requestCache(AbstractHttpConfigurer::disable)
			.oauth2ResourceServer(resource -> resource
				.authenticationManagerResolver(request -> manager(callers, audienceOf(request)))
				.authenticationEntryPoint(signIn(callers))
				.protectedResourceMetadata(metadata -> metadata.protectedResourceMetadataCustomizer(builder -> builder
					.authorizationServer(callers.site())
					.resourceName("BeyondPilot")
					.tlsClientCertificateBoundAccessTokens(false)
					.claims(claims -> {
						Object described = claims.get("resource");
						McpAudience audience = described instanceof String address
								&& address.endsWith(McpAudience.OPERATOR.path()) ? McpAudience.OPERATOR
										: McpAudience.USER;
						claims.put("resource", callers.address(audience));
						claims.put("scopes_supported", new ArrayList<>(List.of(audience.scope())));
					}))))
			.addFilterBefore(new McpCallFilters.BodyLimit(settings.maxRequestBytes()),
					BearerTokenAuthenticationFilter.class)
			.addFilterAfter(new McpCallFilters.ProtocolVersion(), BearerTokenAuthenticationFilter.class)
			.addFilterAfter(new McpCallFilters.CallLimits(settings), McpCallFilters.ProtocolVersion.class);
		return http.build();
	}

	private static McpAudience audienceOf(HttpServletRequest request) {
		String path = request.getRequestURI().substring(request.getContextPath().length());
		return path.startsWith(McpAudience.OPERATOR.path()) ? McpAudience.OPERATOR : McpAudience.USER;
	}

	private static AuthenticationManager manager(McpCallers callers, McpAudience audience) {
		return authentication -> {
			BearerTokenAuthenticationToken bearer = (BearerTokenAuthenticationToken) authentication;
			try {
				return new CallerAuthentication(callers.authenticate(bearer.getToken(), audience), audience);
			}
			catch (McpCallRefused refused) {
				LOG.atInfo()
					.addKeyValue("event", "mcp.call_refused")
					.addKeyValue("server", audience.name().toLowerCase(java.util.Locale.ROOT))
					.addKeyValue("reason", refused.getMessage())
					.log("An MCP call was refused");
				throw new OAuth2AuthenticationException(refused.insufficientScope()
						? BearerTokenErrors.insufficientScope(refused.getMessage(), audience.scope())
						: BearerTokenErrors.invalidToken(refused.getMessage()));
			}
		};
	}

	/**
	 * The answer to a call that may not proceed (RFC 6750 and RFC 9728): the error when there is one, the server's
	 * scope, and the address of its protected resource metadata, which names the authorization server.
	 */
	private static AuthenticationEntryPoint signIn(McpCallers callers) {
		return (HttpServletRequest request, HttpServletResponse response, AuthenticationException failure) -> {
			McpAudience audience = audienceOf(request);
			int status = HttpServletResponse.SC_UNAUTHORIZED;
			StringBuilder header = new StringBuilder("Bearer ");
			if (failure instanceof OAuth2AuthenticationException oauth) {
				OAuth2Error error = oauth.getError();
				header.append("error=\"").append(error.getErrorCode()).append("\", ");
				if (error.getDescription() != null) {
					header.append("error_description=\"").append(error.getDescription()).append("\", ");
				}
				if (error instanceof BearerTokenError bearer) {
					status = bearer.getHttpStatus().value();
				}
			}
			header.append("scope=\"")
				.append(audience.scope())
				.append("\", resource_metadata=\"")
				.append(callers.site())
				.append(METADATA)
				.append(audience.path())
				.append('"');
			response.setHeader("WWW-Authenticate", header.toString());
			response.setStatus(status);
		};
	}

	@Bean
	WebMvcStatelessServerTransport userMcpTransport(McpCallers callers, JsonMapper json) {
		return transport(callers, json, McpAudience.USER);
	}

	@Bean
	RouterFunction<ServerResponse> userMcpRoutes(WebMvcStatelessServerTransport userMcpTransport) {
		return userMcpTransport.getRouterFunction();
	}

	@Bean(destroyMethod = "close")
	McpStatelessSyncServer userMcpServer(WebMvcStatelessServerTransport userMcpTransport, PublicTools tools,
			CallLog log, JsonMapper json) {
		return McpServer.sync(userMcpTransport)
			.serverInfo("BeyondPilot", "1")
			.instructions("Search and read the AI solutions and programs listed on BeyondPilot, GenAI Fund's network "
					+ "for enterprises and AI builders. Use search, then fetch an id it returns.")
			.capabilities(McpSchema.ServerCapabilities.builder().tools(false).build())
			.jsonMapper(new JacksonMcpJsonMapper(json))
			.immediateExecution(true)
			.tools(log.logged("user", tools.search()), log.logged("user", tools.fetch()))
			.build();
	}

	/**
	 * A stateless transport at the server's path. It hands the tools the caller the chain authenticated, and refuses a
	 * browser page of another site (an Origin other than BeyondPilot's), as the MCP specification asks.
	 */
	private static WebMvcStatelessServerTransport transport(McpCallers callers, JsonMapper json, McpAudience audience) {
		return WebMvcStatelessServerTransport.builder()
			.jsonMapper(new JacksonMcpJsonMapper(json))
			.messageEndpoint(audience.path())
			.securityValidator(DefaultServerTransportSecurityValidator.builder().allowedOrigin(callers.site()).build())
			.contextExtractor(request -> {
				Object principal = request.servletRequest().getUserPrincipal();
				return principal instanceof CallerAuthentication call
						? McpTransportContext.create(Map.of(CallLog.CALLER, call.caller())) : McpTransportContext.EMPTY;
			})
			.build();
	}

}
