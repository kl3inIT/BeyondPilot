package ai.genaifund.beyondpilot.config;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.logout.LogoutFilter;
import org.springframework.security.web.authentication.ott.GenerateOneTimeTokenRequestResolver;
import org.springframework.security.web.authentication.ott.OneTimeTokenGenerationSuccessHandler;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

/**
 * The one security filter chain. The web application is the only client and shares this origin, so the endpoints
 * answer with a status and never with a page: 204 for a sent link, a redeemed link and a sign-out; a problem for every
 * refusal. Only the Google round trip redirects, because the browser itself travels it.
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfiguration {

	/** The page of the web application that offers the sign-in methods. */
	private static final String SIGN_IN_PAGE = "/sign-in";

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http,
			OneTimeTokenGenerationSuccessHandler signInLinkSender,
			ObjectProvider<GenerateOneTimeTokenRequestResolver> signInLinkRequest,
			ObjectProvider<ClientRegistrationRepository> oauthClients) throws Exception {
		http
			// A path under /api is closed unless a line here opens it; the web application serves every other path.
			.authorizeHttpRequests(requests -> requests.dispatcherTypeMatchers(DispatcherType.ERROR)
				.permitAll()
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
			.oneTimeTokenLogin(link -> {
				// Naming the page moves the redeeming URL onto it unless that URL is named too.
				link.loginPage(SIGN_IN_PAGE)
					.loginProcessingUrl("/login/ott")
					.showDefaultSubmitPage(false)
					.tokenGenerationSuccessHandler(signInLinkSender)
					.successHandler(
							(request, response, authentication) -> response.setStatus(HttpServletResponse.SC_NO_CONTENT))
					.failureHandler((request, response, failure) -> response
						.sendError(HttpServletResponse.SC_UNAUTHORIZED));
				signInLinkRequest.ifAvailable(link::generateRequestResolver);
			})
			// Without Spring's CSRF support, sign-out would also answer GET, which a link on another site can trigger.
			.logout(logout -> logout
				.logoutRequestMatcher(PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/logout"))
				.logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)));
		if (oauthClients.getIfAvailable() != null) {
			http.oauth2Login(google -> google.loginPage(SIGN_IN_PAGE)
				.successHandler(new ReturnToSuccessHandler())
				.failureHandler(new SimpleUrlAuthenticationFailureHandler(SIGN_IN_PAGE + "?error=google")))
				.addFilterBefore(new ReturnToFilter(), OAuth2AuthorizationRequestRedirectFilter.class);
		}
		return http.build();
	}
}
