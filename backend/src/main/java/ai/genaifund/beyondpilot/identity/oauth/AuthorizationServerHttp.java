package ai.genaifund.beyondpilot.identity.oauth;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import ai.genaifund.beyondpilot.identity.Actor;
import org.jspecify.annotations.Nullable;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationCode;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationToken;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.util.UriUtils;

/** The web side of the authorization server: who signs in, where a stranger is sent, and the answer to the app. */
final class AuthorizationServerHttp {

	/** The web application's page that offers the sign-in methods. */
	static final String SIGN_IN_PAGE = "/sign-in";

	/** The web application's page that asks the person to allow an app. */
	static final String CONSENT_PAGE = "/oauth-consent";

	private AuthorizationServerHttp() {
	}

	/**
	 * Sends a person who is not signed in to the sign-in page, which brings them back to the authorize request after.
	 * The authorize request is a full address under this origin, which the page's return check accepts.
	 */
	static AuthenticationEntryPoint signIn() {
		return (request, response, failure) -> {
			String back = request.getRequestURI() + (request.getQueryString() == null ? "" : "?" + request.getQueryString());
			response.sendRedirect(request.getContextPath() + SIGN_IN_PAGE + "?returnTo="
					+ URLEncoder.encode(back, StandardCharsets.UTF_8));
		};
	}

	/**
	 * The code sent back to the app, with the issuer (RFC 9207), which ChatGPT and Codex need to use their stable
	 * redirect address and MCP 2026-07-28 asks for.
	 */
	static AuthenticationSuccessHandler codeWithIssuer(OAuthSettings settings) {
		return (request, response, authentication) -> {
			OAuth2AuthorizationCodeRequestAuthenticationToken answer = (OAuth2AuthorizationCodeRequestAuthenticationToken) authentication;
			OAuth2AuthorizationCode code = answer.getAuthorizationCode();
			String redirect = answer.getRedirectUri();
			if (code == null || redirect == null) {
				response.sendError(HttpServletResponse.SC_BAD_REQUEST);
				return;
			}
			UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(redirect)
				.queryParam(OAuth2ParameterNames.CODE, code.getTokenValue());
			if (answer.getState() != null && !answer.getState().isEmpty()) {
				uri.queryParam(OAuth2ParameterNames.STATE, UriUtils.encode(answer.getState(), StandardCharsets.UTF_8));
			}
			uri.queryParam("iss", UriUtils.encode(settings.issuer(), StandardCharsets.UTF_8));
			response.sendRedirect(uri.build(true).toUriString());
		};
	}

	/**
	 * Presents the signed-in person to the authorization server by their account alone. The server stores who
	 * consented with each authorization; an account identifier is what it needs and all it keeps, whatever way the
	 * person signed in. The session itself is left as it is.
	 */
	static final class AccountPrincipal extends OncePerRequestFilter {

		private final SecurityContextHolderStrategy contexts = SecurityContextHolder.getContextHolderStrategy();

		@Override
		protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
				throws ServletException, IOException {
			SecurityContext context = contexts.getContext();
			Actor actor = actorOf(context.getAuthentication());
			if (actor != null) {
				SecurityContext account = contexts.createEmptyContext();
				account.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(actor.accountId().toString(),
						null, AuthorityUtils.NO_AUTHORITIES));
				contexts.setContext(account);
			}
			chain.doFilter(request, response);
		}

		private static @Nullable Actor actorOf(@Nullable Authentication authentication) {
			return SignedIn.actorOf(authentication);
		}

	}

}
