package ai.genaifund.beyondpilot.identity;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.dto.ConnectedAppResponse;
import ai.genaifund.beyondpilot.identity.dto.ConnectingAppResponse;
import ai.genaifund.beyondpilot.identity.oauth.ConnectingApps;
import ai.genaifund.beyondpilot.identity.persistence.OAuthTableRepository;
import ai.genaifund.beyondpilot.identity.persistence.OAuthTableRepository.Connection;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The AI apps people connect to BeyondPilot's MCP servers (BEY-78). */
@Service
public class AppConnections {

	private static final String APP = "mcp_app";

	private final ConnectingApps connecting;

	private final OAuthTableRepository tables;

	private final IdentityService identity;

	private final AuditTrail audit;

	AppConnections(ConnectingApps connecting, OAuthTableRepository tables, IdentityService identity, AuditTrail audit) {
		this.connecting = connecting;
		this.tables = tables;
		this.identity = identity;
		this.audit = audit;
	}

	/**
	 * The app waiting for the caller's answer, as the consent page shows it: its name, the host its document lives on,
	 * where the answer goes, and whether BeyondPilot has reviewed it.
	 * @throws IdentityException {@link IdentityErrorCode#APP_REQUEST_NOT_FOUND} when no request of the caller's waits
	 * with this app and state
	 */
	public ConnectingAppResponse connectingApp(Actor actor, String clientId, String state) {
		identity.requireActive(actor);
		return connecting.waiting(actor.accountId(), clientId, state)
			.map(app -> new ConnectingAppResponse(app.clientId(), app.name(), app.host(), app.returnsTo(), app.local(),
					app.reviewed(), app.anyLocalApp()))
			.orElseThrow(() -> new IdentityException(IdentityErrorCode.APP_REQUEST_NOT_FOUND,
					"No waiting request for this client and state"));
	}

	/** The apps the caller has connected and not revoked, the latest used first. */
	@Transactional(readOnly = true)
	public List<ConnectedAppResponse> connectedApps(Actor actor) {
		identity.requireActive(actor);
		return tables.connectionsOf(actor.accountId().toString()).stream().map(this::response).toList();
	}

	/**
	 * Ends every connection of the caller with this app: its refresh token stops at once, and the MCP servers refuse
	 * its access token on the next call.
	 * @throws IdentityException {@link IdentityErrorCode#APP_NOT_CONNECTED} when the caller has not connected it
	 */
	@Transactional
	public void revoke(Actor actor, String appId) {
		Person person = identity.person(actor);
		Connection connection = tables.connectionsOf(actor.accountId().toString())
			.stream()
			.filter(found -> found.appId().equals(appId))
			.findFirst()
			.orElseThrow(() -> new IdentityException(IdentityErrorCode.APP_NOT_CONNECTED,
					"No connection of this caller with app " + appId));
		tables.revoke(actor.accountId().toString(), appId);
		ConnectedAppResponse app = response(connection);
		audit.record(new AuditRecord(AuditAction.MCP_APP_REVOKE,
				new AuditRecord.Actor(person.accountId(), person.label(), person.email()),
				new AuditRecord.Resource(APP, app.clientId(), app.name()), Map.of()));
	}

	private ConnectedAppResponse response(Connection connection) {
		ConnectingApps.AppIdentity app = connecting.identify(connection.clientId(), connection.clientName());
		Set<String> scopes = connection.scopes() == null ? Set.of()
				: Arrays.stream(connection.scopes().split(",")).map(String::strip).collect(Collectors.toSet());
		List<String> servers = Arrays.stream(McpAudience.values())
			.filter(audience -> scopes.contains(audience.scope()))
			.map(audience -> audience.name().toLowerCase(java.util.Locale.ROOT))
			.toList();
		return new ConnectedAppResponse(connection.appId(), connection.clientId(), app.name(), app.host(),
				app.reviewed(), servers, connection.allowedAt(), connection.usedAt());
	}

}
