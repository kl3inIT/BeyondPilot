package ai.genaifund.beyondpilot.identity.oauth;

import java.util.List;
import java.util.Optional;

import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Reads the access token an AI app sends to an MCP server: signed with BeyondPilot's own key, issued by this server, in
 * date, and for exactly the server called. Nothing leaves the process: the key is the one tokens are signed with.
 */
@Component
public class McpBearerTokens {

	private static final Logger LOG = LoggerFactory.getLogger(McpBearerTokens.class);

	private final String issuer;

	private final JwtDecoder userServer;

	private final JwtDecoder operatorServer;

	McpBearerTokens(OAuthSettings settings, JWKSource<SecurityContext> keys) {
		this.issuer = settings.issuer();
		this.userServer = decoder(keys, settings.issuer(), settings.userServer());
		this.operatorServer = decoder(keys, settings.issuer(), settings.operatorServer());
	}

	private static JwtDecoder decoder(JWKSource<SecurityContext> keys, String issuer, String audience) {
		NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSource(keys).build();
		OAuth2TokenValidator<Jwt> exactAudience = new JwtClaimValidator<List<String>>("aud",
				aud -> aud != null && aud.equals(List.of(audience)));
		decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer),
				exactAudience));
		return decoder;
	}

	/**
	 * The token's claims, when it is a valid token for this server.
	 * @param operator whether the server called is the operators' one
	 */
	public Optional<Jwt> read(String token, boolean operator) {
		try {
			return Optional.of((operator ? operatorServer : userServer).decode(token));
		}
		catch (JwtException invalid) {
			LOG.atInfo()
				.addKeyValue("event", "identity.oauth.bearer_token_invalid")
				.addKeyValue("error_type", invalid.getClass().getName())
				.log("An MCP access token was not accepted");
			return Optional.empty();
		}
	}

	/** The public address of BeyondPilot, which issues the tokens. */
	public String issuer() {
		return issuer;
	}

	/** The claim naming the app the token was issued to. */
	public static String clientIdOf(Jwt jwt) {
		return jwt.getClaimAsString(McpTokens.CLIENT_ID);
	}

	/** The claim naming the connection the token belongs to. */
	public static String connectionOf(Jwt jwt) {
		return jwt.getClaimAsString(McpTokens.CONNECTION);
	}

}
