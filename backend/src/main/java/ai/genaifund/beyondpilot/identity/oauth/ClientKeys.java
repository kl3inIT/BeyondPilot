package ai.genaifund.beyondpilot.identity.oauth;

import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jose.util.Resource;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoderFactory;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.authorization.authentication.JwtClientAssertionDecoderFactory;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.web.client.RestClient;

/**
 * Checks the assertion a client signs its token requests with ({@code private_key_jwt}), with the keys at the
 * {@code jwks_uri} its metadata document names. Spring's own factory reads that address with a client of its own; this
 * one reads it through {@link OutsideHttp}, so an outsider's document cannot point the server at an internal address.
 * The claims are checked as Spring checks them.
 */
final class ClientKeys implements JwtDecoderFactory<RegisteredClient> {

	/** A key set is a few kilobytes. */
	private static final int MAX_BYTES = 64 * 1024;

	private final RestClient http = OutsideHttp.client(MAX_BYTES);

	private final Map<String, JwtDecoder> decoders = new ConcurrentHashMap<>();

	@Override
	public JwtDecoder createDecoder(RegisteredClient client) {
		String keys = client.getClientSettings().getJwkSetUrl();
		if (keys == null || keys.isBlank()) {
			throw new OAuth2AuthenticationException(new OAuth2Error(OAuth2ErrorCodes.INVALID_CLIENT));
		}
		// Keyed by the address too: a document read again with another key set gets a new decoder.
		return decoders.computeIfAbsent(client.getId() + " " + keys, key -> decoder(client, keys));
	}

	private JwtDecoder decoder(RegisteredClient client, String keys) {
		JWKSource<SecurityContext> source;
		try {
			source = JWKSourceBuilder.create(URI.create(keys).toURL(), this::read).build();
		}
		catch (MalformedURLException | IllegalArgumentException malformed) {
			throw new OAuth2AuthenticationException(new OAuth2Error(OAuth2ErrorCodes.INVALID_CLIENT));
		}
		DefaultJWTProcessor<SecurityContext> processor = new DefaultJWTProcessor<>();
		processor.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, source));
		// The claims are Spring's to check, below.
		processor.setJWTClaimsSetVerifier((claims, context) -> {
		});
		NimbusJwtDecoder decoder = new NimbusJwtDecoder(processor);
		decoder.setJwtValidator(JwtClientAssertionDecoderFactory.DEFAULT_JWT_VALIDATOR_FACTORY.apply(client));
		return decoder;
	}

	/** Nimbus's reader, over {@link OutsideHttp}. */
	private Resource read(URL url) {
		String body = http.get().uri(URI.create(url.toString())).retrieve().body(String.class);
		return new Resource(body == null ? "" : body, "application/json");
	}

}
