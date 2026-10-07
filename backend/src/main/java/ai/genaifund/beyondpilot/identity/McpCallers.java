package ai.genaifund.beyondpilot.identity;

import java.util.List;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.oauth.McpBearerTokens;
import ai.genaifund.beyondpilot.identity.persistence.OAuthTableRepository;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Who calls an MCP server. Every call is checked afresh, so nothing that changed since the token was issued is missed:
 * the token is for that server and carries its scope, its connection still stands (a revoke ends it at once), the
 * account is active, and for the operators' server the account is an operator now.
 */
@Service
public class McpCallers {

	private final McpBearerTokens tokens;

	private final OAuthTableRepository tables;

	private final IdentityService identity;

	McpCallers(McpBearerTokens tokens, OAuthTableRepository tables, IdentityService identity) {
		this.tokens = tokens;
		this.tables = tables;
		this.identity = identity;
	}

	/** The public address of BeyondPilot: its authorization server, and the base of its pages and MCP servers. */
	public String site() {
		return tokens.issuer();
	}

	/** The full address of an MCP server, which its tokens name as their audience. */
	public String address(McpAudience audience) {
		return tokens.issuer() + audience.path();
	}

	/**
	 * The caller of {@code audience} presenting this bearer token.
	 * @throws McpCallRefused when the call may not proceed
	 */
	@Transactional(readOnly = true)
	public McpCaller authenticate(String token, McpAudience audience) {
		Jwt jwt = tokens.read(token, audience == McpAudience.OPERATOR)
			.orElseThrow(() -> new McpCallRefused("Not a token for this server", false));
		List<String> scopes = jwt.getClaimAsStringList("scope");
		if (scopes == null || !scopes.contains(audience.scope())) {
			throw new McpCallRefused("The token lacks the server's scope", true);
		}
		UUID accountId;
		try {
			accountId = UUID.fromString(jwt.getSubject());
		}
		catch (IllegalArgumentException | NullPointerException notAnAccount) {
			throw new McpCallRefused("The token names no account", false);
		}
		String connection = McpBearerTokens.connectionOf(jwt);
		String clientId = McpBearerTokens.clientIdOf(jwt);
		if (connection == null || clientId == null || !tables.isStanding(connection, accountId.toString())) {
			throw new McpCallRefused("The connection has ended", false);
		}
		Actor actor = new Actor(accountId);
		try {
			identity.requireActive(actor);
		}
		catch (IdentityException disabled) {
			throw new McpCallRefused("The account is disabled", false);
		}
		if (audience == McpAudience.OPERATOR && !identity.isOperator(actor)) {
			throw new McpCallRefused("The account is no longer an operator", false);
		}
		return new McpCaller(accountId, clientId, connection);
	}

}
