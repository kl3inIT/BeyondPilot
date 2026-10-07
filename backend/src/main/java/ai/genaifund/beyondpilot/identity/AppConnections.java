package ai.genaifund.beyondpilot.identity;

import java.net.URI;
import java.net.URISyntaxException;

import ai.genaifund.beyondpilot.identity.dto.ConnectingAppResponse;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.stereotype.Service;

/** The AI apps people connect to BeyondPilot's MCP servers (BEY-78). */
@Service
public class AppConnections {

	private final RegisteredClientRepository clients;

	private final IdentityService identity;

	AppConnections(RegisteredClientRepository clients, IdentityService identity) {
		this.clients = clients;
		this.identity = identity;
	}

	/**
	 * The app asking the person to connect, as the consent page names it: its name, and the host its client ID belongs
	 * to, which is what proves who it is.
	 * @throws IdentityException {@link IdentityErrorCode#APP_NOT_FOUND} when no such app may sign in
	 */
	public ConnectingAppResponse connectingApp(Actor actor, String clientId) {
		identity.requireActive(actor);
		RegisteredClient client = clients.findByClientId(clientId);
		if (client == null) {
			throw new IdentityException(IdentityErrorCode.APP_NOT_FOUND, "Unknown OAuth client");
		}
		return new ConnectingAppResponse(client.getClientId(), client.getClientName(), hostOf(client.getClientId()));
	}

	private static String hostOf(String clientId) {
		try {
			String host = new URI(clientId).getHost();
			return host == null ? "beyondpilot" : host;
		}
		catch (URISyntaxException registeredByBeyondPilot) {
			return "beyondpilot";
		}
	}

}
