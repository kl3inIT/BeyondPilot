package ai.genaifund.beyondpilot.identity.oauth;

import java.time.Duration;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * How AI apps sign in ({@code beyondpilot.identity.oauth}).
 * @param issuer the public address of BeyondPilot, which names the authorization server and both MCP servers
 * @param signingKey the RSA private key that signs access tokens, PKCS#8 in PEM; without it a key is made at start and
 * every token stops working at the next start, which only a development machine accepts
 * @param accessTokenLifetime how long an access token works
 * @param refreshTokenLifetime how long a refresh token works unused; each use replaces it
 * @param connectionLifetime how long a connection lasts from the person's consent, however often it is refreshed
 * @param documentFetchesPerRequesterPerMinute how many client ID metadata documents one requester's address may make
 * the server fetch in a minute; documents read before are stored, so only a new app or an outsider's address fetches
 * @param documentFetchesPerHostPerMinute how many documents of one host the server fetches in a minute
 * @param documentFetchesPerMinute how many the server fetches in a minute for every requester together, the last guard
 * when many addresses try at once
 */
@ConfigurationProperties("beyondpilot.identity.oauth")
record OAuthSettings(String issuer, @Nullable String signingKey,
		@DefaultValue("1h") Duration accessTokenLifetime, @DefaultValue("30d") Duration refreshTokenLifetime,
		@DefaultValue("180d") Duration connectionLifetime, @DefaultValue("10") int documentFetchesPerRequesterPerMinute,
		@DefaultValue("30") int documentFetchesPerHostPerMinute, @DefaultValue("120") int documentFetchesPerMinute) {

	/** The address of the server every signed-in person may use. */
	String userServer() {
		return issuer + "/mcp";
	}

	/** The address of the server for operators. */
	String operatorServer() {
		return issuer + "/mcp/operator";
	}

}
