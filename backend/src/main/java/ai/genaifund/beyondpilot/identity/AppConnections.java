package ai.genaifund.beyondpilot.identity;

import ai.genaifund.beyondpilot.identity.dto.ConnectingAppResponse;
import ai.genaifund.beyondpilot.identity.oauth.ConnectingApps;
import org.springframework.stereotype.Service;

/** The AI apps people connect to BeyondPilot's MCP servers (BEY-78). */
@Service
public class AppConnections {

	private final ConnectingApps connecting;

	private final IdentityService identity;

	AppConnections(ConnectingApps connecting, IdentityService identity) {
		this.connecting = connecting;
		this.identity = identity;
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

}
