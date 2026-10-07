package ai.genaifund.beyondpilot.identity.oauth;

import java.time.Duration;
import java.util.List;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * How AI apps sign in ({@code beyondpilot.identity.oauth}).
 * @param issuer the public address of BeyondPilot, which names the authorization server and both MCP servers
 * @param signingKey the RSA private key that signs access tokens, PKCS#8 in PEM; without it a key is made at start and
 * every token stops working at the next start, which only a development machine accepts
 * @param trustedClientHosts the hosts whose client ID metadata documents are fetched; any other is refused, so the server
 * never fetches an address an outsider chose
 * @param accessTokenLifetime how long an access token works
 * @param refreshTokenLifetime how long a refresh token works unused; each use replaces it
 * @param connectionLifetime how long a connection lasts from the person's consent, however often it is refreshed
 */
@ConfigurationProperties("beyondpilot.identity.oauth")
record OAuthSettings(String issuer, @Nullable String signingKey,
		@DefaultValue({ "claude.ai", "claude.com", "chatgpt.com" }) List<String> trustedClientHosts,
		@DefaultValue("1h") Duration accessTokenLifetime, @DefaultValue("30d") Duration refreshTokenLifetime,
		@DefaultValue("180d") Duration connectionLifetime) {

	/** The address of the server every signed-in person may use. */
	String userServer() {
		return issuer + "/mcp";
	}

	/** The address of the server for operators. */
	String operatorServer() {
		return issuer + "/mcp/operator";
	}

}
