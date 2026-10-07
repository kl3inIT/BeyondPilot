package ai.genaifund.beyondpilot.identity.oauth;

import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import java.util.List;

import ai.genaifund.beyondpilot.identity.IdentityService;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.oauth2.server.authorization.OAuth2AuthorizationServerConfigurer;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.server.authorization.JdbcOAuth2AuthorizationConsentService;
import org.springframework.security.oauth2.server.authorization.JdbcOAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationConsentService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationCodeRequestAuthenticationProvider;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AuthorizationConsentAuthenticationProvider;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.DelegatingOAuth2TokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.JwtGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

/**
 * The authorization server: its stores, its signing key, and its filter chain, which comes before the application's
 * and covers its endpoints only. It shares the session, so a person signed in on the site is signed in here.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(OAuthSettings.class)
class AuthorizationServerConfiguration {

	private static final Logger LOG = LoggerFactory.getLogger(AuthorizationServerConfiguration.class);

	@Bean
	OAuth2AuthorizationService oauthAuthorizations(JdbcOperations jdbc, McpClients clients) {
		return new JdbcOAuth2AuthorizationService(jdbc, clients);
	}

	@Bean
	OAuth2AuthorizationConsentService oauthConsents(JdbcOperations jdbc, McpClients clients) {
		return new JdbcOAuth2AuthorizationConsentService(jdbc, clients);
	}

	@Bean
	AuthorizationServerSettings authorizationServerSettings(OAuthSettings settings) {
		return AuthorizationServerSettings.builder().issuer(settings.issuer()).build();
	}

	@Bean
	JWKSource<SecurityContext> oauthSigningKeys(OAuthSettings settings) {
		return new ImmutableJWKSet<>(new JWKSet(signingKey(settings)));
	}

	@Bean
	McpTokens mcpTokens(OAuthSettings settings) {
		return new McpTokens(settings);
	}

	@Bean
	OAuth2TokenGenerator<OAuth2Token> oauthTokens(JWKSource<SecurityContext> keys, McpTokens tokens) {
		JwtGenerator jwt = new JwtGenerator(new NimbusJwtEncoder(keys));
		jwt.setJwtCustomizer(tokens);
		return new DelegatingOAuth2TokenGenerator(jwt, new PublicClientRefresh.TokenGenerator());
	}

	/** Cursor's client exists from the first start, and stays up to date with this code. */
	@Bean
	ApplicationRunner cursorClient(McpClients clients) {
		return arguments -> clients.registerCursor();
	}

	/**
	 * The authorization server's chain. Every endpoint is Spring's; this adds the consent page of the web application,
	 * the rules of {@link McpConsent}, refresh for apps without a secret, the issuer on the answer, and what the metadata
	 * advertises.
	 */
	@Bean
	@Order(1)
	SecurityFilterChain authorizationServerFilterChain(HttpSecurity http, McpClients clients, McpTokens tokens,
			IdentityService identity, OAuthSettings settings) {
		McpConsent consent = new McpConsent(tokens, identity);
		OAuth2AuthorizationServerConfigurer server = new OAuth2AuthorizationServerConfigurer();
		http.securityMatcher(server.getEndpointsMatcher())
			.with(server, as -> as.registeredClientRepository(clients)
				.authorizationEndpoint(endpoint -> endpoint.consentPage(AuthorizationServerHttp.CONSENT_PAGE)
					.authorizationResponseHandler(AuthorizationServerHttp.codeWithIssuer(settings))
					.authenticationProviders(providers -> providers.replaceAll(provider -> switch (provider) {
						case OAuth2AuthorizationCodeRequestAuthenticationProvider request -> {
							request.setAuthenticationValidator(consent.requestValidator());
							yield request;
						}
						case OAuth2AuthorizationConsentAuthenticationProvider given ->
							consent.operatorScopeForOperatorsOnly(given);
						default -> provider;
					})))
				.clientAuthentication(client -> client
					.authenticationConverters(converters -> converters.addFirst(new PublicClientRefresh.RequestConverter()))
					.authenticationProviders(
							providers -> providers.addFirst(new PublicClientRefresh.ClientProvider(clients))))
				.authorizationServerMetadataEndpoint(metadata -> metadata.authorizationServerMetadataCustomizer(
						builder -> builder.scopes(scopes -> scopes.addAll(McpScopes.ALL))
							.codeChallengeMethods(methods -> {
								methods.clear();
								methods.add("S256");
							})
							.tokenEndpointAuthenticationMethods(methods -> {
								methods.clear();
								methods.addAll(List.of("none", "private_key_jwt"));
							})
							.claim("client_id_metadata_document_supported", true)
							.claim("authorization_response_iss_parameter_supported", true))))
			.authorizeHttpRequests(requests -> requests.anyRequest().authenticated())
			.requestCache(AbstractHttpConfigurer::disable)
			.addFilterAfter(new AuthorizationServerHttp.AccountPrincipal(), SecurityContextHolderFilter.class)
			.exceptionHandling(handling -> handling
				.defaultAuthenticationEntryPointFor(AuthorizationServerHttp.signIn(),
						new MediaTypeRequestMatcher(MediaType.TEXT_HTML))
				.defaultAuthenticationEntryPointFor(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
						request -> true));
		return http.build();
	}

	/**
	 * The key that signs access tokens: the deployment's, or one made now on a machine that has none, whose tokens stop
	 * working at the next start.
	 */
	private static RSAKey signingKey(OAuthSettings settings) {
		try {
			KeyPair pair;
			if (settings.signingKey() == null || settings.signingKey().isBlank()) {
				LOG.atWarn()
					.addKeyValue("event", "identity.oauth.signing_key_generated")
					.log("No signing key is configured; one was made for this run only");
				KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
				generator.initialize(2048);
				pair = generator.generateKeyPair();
			}
			else {
				pair = fromPem(settings.signingKey());
			}
			return new RSAKey.Builder((RSAPublicKey) pair.getPublic()).privateKey((RSAPrivateKey) pair.getPrivate())
				.keyIDFromThumbprint()
				.build();
		}
		catch (NoSuchAlgorithmException | InvalidKeySpecException | com.nimbusds.jose.JOSEException failure) {
			throw new IllegalStateException("The access token signing key is not a valid RSA key", failure);
		}
	}

	private static KeyPair fromPem(String pem) throws NoSuchAlgorithmException, InvalidKeySpecException {
		String body = pem.replaceAll("-----(BEGIN|END) PRIVATE KEY-----", "").replaceAll("\\s", "");
		KeyFactory rsa = KeyFactory.getInstance("RSA");
		RSAPrivateCrtKey key = (RSAPrivateCrtKey) rsa.generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(body)));
		RSAPublicKey publicKey = (RSAPublicKey) rsa
			.generatePublic(new RSAPublicKeySpec(key.getModulus(), key.getPublicExponent()));
		return new KeyPair(publicKey, key);
	}

}
