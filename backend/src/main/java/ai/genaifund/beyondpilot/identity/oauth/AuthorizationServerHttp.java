package ai.genaifund.beyondpilot.identity.oauth;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityException;
import ai.genaifund.beyondpilot.identity.IdentityService;
import org.jspecify.annotations.Nullable;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationCode;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationException;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationToken;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
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
	 * The error sent back to the app, with the issuer. Not for a request no person has answered yet from an app on a
	 * host BeyondPilot has not reviewed: anyone can publish such an app with redirects to their own site, and sending a
	 * browser there straight from BeyondPilot would make it an open redirect (RFC 9700 §4.11.2). That error is shown
	 * here instead. After the person's answer, as when they deny, it goes back to the app.
	 */
	static AuthenticationFailureHandler errorAnswer(OAuthSettings settings, ClientMetadataDocuments documents) {
		return (request, response, failure) -> {
			OAuth2Error error = failure instanceof OAuth2AuthenticationException oauth ? oauth.getError()
					: new OAuth2Error(OAuth2ErrorCodes.INVALID_REQUEST);
			OAuth2AuthorizationCodeRequestAuthenticationToken asked = failure instanceof OAuth2AuthorizationCodeRequestAuthenticationException codeRequest
					? codeRequest.getAuthorizationCodeRequestAuthentication() : null;
			String redirect = asked == null ? null : asked.getRedirectUri();
			if (redirect == null || redirect.isEmpty()
					|| (!isPersonsAnswer(request) && !isReviewedOrOwn(asked.getClientId(), documents))) {
				response.sendError(HttpServletResponse.SC_BAD_REQUEST, error.getErrorCode());
				return;
			}
			UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(redirect)
				.queryParam(OAuth2ParameterNames.ERROR, error.getErrorCode());
			if (error.getDescription() != null && !error.getDescription().isEmpty()) {
				uri.queryParam(OAuth2ParameterNames.ERROR_DESCRIPTION,
						UriUtils.encode(error.getDescription(), StandardCharsets.UTF_8));
			}
			if (asked.getState() != null && !asked.getState().isEmpty()) {
				uri.queryParam(OAuth2ParameterNames.STATE, UriUtils.encode(asked.getState(), StandardCharsets.UTF_8));
			}
			uri.queryParam("iss", UriUtils.encode(settings.issuer(), StandardCharsets.UTF_8));
			response.sendRedirect(uri.build(true).toUriString());
		};
	}

	/**
	 * Whether this is the consent page's answer, as Spring tells it: a POST without {@code response_type}. An
	 * authorization request may be posted too, by a page anyone can make, so the method alone proves no answer.
	 */
	private static boolean isPersonsAnswer(HttpServletRequest request) {
		return "POST".equals(request.getMethod()) && request.getParameter(OAuth2ParameterNames.RESPONSE_TYPE) == null;
	}

	private static boolean isReviewedOrOwn(String clientId, ClientMetadataDocuments documents) {
		if (clientId.equals(McpClients.CURSOR) || clientId.equals(McpClients.LOCAL)) {
			return true;
		}
		try {
			String host = java.net.URI.create(clientId).getHost();
			return host != null && documents.isReviewed(host);
		}
		catch (IllegalArgumentException malformed) {
			return false;
		}
	}

	/**
	 * Presents the signed-in person to the authorization server by their account alone. The server stores who
	 * consented with each authorization; an account identifier is what it needs and all it keeps, whatever way the
	 * person signed in. An account disabled since it signed in counts as nobody, so its session cannot connect an
	 * app. The session itself is left as it is.
	 */
	static final class AccountPrincipal extends OncePerRequestFilter {

		private final SecurityContextHolderStrategy contexts = SecurityContextHolder.getContextHolderStrategy();

		private final IdentityService identity;

		AccountPrincipal(IdentityService identity) {
			this.identity = identity;
		}

		@Override
		protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
				throws ServletException, IOException {
			SecurityContext context = contexts.getContext();
			Actor actor = actorOf(context.getAuthentication());
			if (actor != null) {
				SecurityContext account = contexts.createEmptyContext();
				if (isActive(actor)) {
					account.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(actor.accountId().toString(),
							null, AuthorityUtils.NO_AUTHORITIES));
				}
				contexts.setContext(account);
			}
			chain.doFilter(request, response);
		}

		private static @Nullable Actor actorOf(@Nullable Authentication authentication) {
			return SignedIn.actorOf(authentication);
		}

		private boolean isActive(Actor actor) {
			try {
				identity.requireActive(actor);
				return true;
			}
			catch (IdentityException disabled) {
				return false;
			}
		}

	}

}
