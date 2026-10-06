package ai.genaifund.beyondpilot.config;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.security.web.authentication.AuthenticationConverter;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.logout.LogoutFilter;
import org.springframework.security.web.authentication.ott.GenerateOneTimeTokenRequestResolver;
import org.springframework.security.web.authentication.ott.OneTimeTokenGenerationSuccessHandler;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

/**
 * The one security filter chain. The web application is the only client and shares this origin, so the endpoints
 * answer with a status and never with a page: 204 for a sent code, an accepted code and a sign-out; a problem for every
 * refusal. Only the Google round trip redirects, because the browser itself travels it.
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfiguration {

	/** The page of the web application that offers the sign-in methods. */
	private static final String SIGN_IN_PAGE = "/sign-in";

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http,
			OneTimeTokenGenerationSuccessHandler signInCodeSender,
			ObjectProvider<GenerateOneTimeTokenRequestResolver> signInCodeRequest,
			ObjectProvider<AuthenticationConverter> signInCodeConverter,
			ObjectProvider<ClientRegistrationRepository> oauthClients,
			@Qualifier("operatorsOnly") ObjectProvider<AuthorizationManager<RequestAuthorizationContext>> operatorsOnly)
			throws Exception {
		// The module that knows the roles supplies the check; without it the operators' paths stay closed.
		AuthorizationManager<RequestAuthorizationContext> operators = operatorsOnly
			.getIfAvailable(() -> (authentication, request) -> new AuthorizationDecision(false));
		http
			// A path under /api is closed unless a line here opens it; the web application serves every other path.
			.authorizeHttpRequests(requests -> requests.dispatcherTypeMatchers(DispatcherType.ERROR)
				.permitAll()
				// A public file, such as an image of a program, is read without a session.
				.requestMatchers(HttpMethod.GET, "/api/storage/files/*")
				.permitAll()
				// The programs and their pages are for visitors; an operator's session only adds the drafts.
				.requestMatchers(HttpMethod.GET, "/api/program/programs", "/api/program/programs/*")
				.permitAll()
				// The directories of approved solutions and talent, and the page of an approved organization, are read
				// without a session. So is the deck of an approved solution; a session only adds the deck of one that
				// is not approved, for those who may read it.
				.requestMatchers(HttpMethod.GET, "/api/solution/solutions", "/api/solution/solutions/*",
						"/api/solution/solutions/*/deck", "/api/solution/deployments", "/api/usecase/use-cases",
						"/api/talent/profiles", "/api/talent/profiles/*", "/api/organization/organizations/*")
				.permitAll()
				// Search returns only what the public site shows.
				.requestMatchers(HttpMethod.GET, "/api/search")
				.permitAll()
				// The audit module cannot ask who is an operator (ADR 0004), so the chain asks for it.
				.requestMatchers("/api/audit/**")
				.access(operators)
				.requestMatchers("/api/**")
				.authenticated()
				.anyRequest()
				.permitAll())
			// CsrfHeaderFilter replaces the token: a custom header cannot be sent across origins without a preflight.
			.csrf(AbstractHttpConfigurer::disable)
			.addFilterBefore(new CsrfHeaderFilter(), LogoutFilter.class)
			// Nothing is remembered for an anonymous request, so browsing creates no session.
			.requestCache(AbstractHttpConfigurer::disable)
			.exceptionHandling(handling -> handling
				.authenticationEntryPoint((request, response, failure) -> response
					.sendError(HttpServletResponse.SC_UNAUTHORIZED))
				.accessDeniedHandler(
						(request, response, failure) -> response.sendError(HttpServletResponse.SC_FORBIDDEN)))
			.oneTimeTokenLogin(code -> {
				// Naming the page moves the redeeming URL onto it unless that URL is named too.
				code.loginPage(SIGN_IN_PAGE)
					.loginProcessingUrl("/login/ott")
					.showDefaultSubmitPage(false)
					.tokenGenerationSuccessHandler(signInCodeSender)
					.successHandler(
							(request, response, authentication) -> response.setStatus(HttpServletResponse.SC_NO_CONTENT))
					.failureHandler((request, response, failure) -> response.sendError(signInFailureStatus(failure)));
				signInCodeRequest.ifAvailable(code::generateRequestResolver);
				signInCodeConverter.ifUnique(code::authenticationConverter);
			})
			// Without Spring's CSRF support, sign-out would also answer GET, which a link on another site can trigger.
			.logout(logout -> logout
				.logoutRequestMatcher(PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/logout"))
				.logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)));
		if (oauthClients.getIfAvailable() != null) {
			http.oauth2Login(google -> google.loginPage(SIGN_IN_PAGE)
				.successHandler(new ReturnToSuccessHandler())
				.failureHandler(new ProviderSignInFailureHandler("google", SIGN_IN_PAGE + "?error=google")))
				.addFilterBefore(new ReturnToFilter(), OAuth2AuthorizationRequestRedirectFilter.class);
		}
		return http.build();
	}

	/**
	 * A refused code says why by its status, so the screen can tell the person what to do next: 401 try again, 410 ask
	 * for a new code, 429 too many wrong codes, 403 the account is disabled.
	 */
	private static int signInFailureStatus(AuthenticationException failure) {
		return switch (failure) {
			case CredentialsExpiredException expired -> HttpServletResponse.SC_GONE;
			case LockedException locked -> 429;
			case DisabledException disabled -> HttpServletResponse.SC_FORBIDDEN;
			default -> HttpServletResponse.SC_UNAUTHORIZED;
		};
	}
}
