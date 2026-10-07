package ai.genaifund.beyondpilot.identity.oauth;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.stereotype.Component;

/**
 * What the consent page shows of an app waiting for a person's answer: who it is, where its document lives, where the
 * answer goes, and whether BeyondPilot has reviewed its host. An app on a host not reviewed is named by its host. The request is found by its state and must be this
 * person's, so nobody reads another's.
 */
@Component
public class ConnectingApps {

	private static final OAuth2TokenType STATE = new OAuth2TokenType(OAuth2ParameterNames.STATE);

	private final McpClients clients;

	private final OAuth2AuthorizationService authorizations;

	private final ClientMetadataDocuments documents;

	ConnectingApps(McpClients clients, OAuth2AuthorizationService authorizations, ClientMetadataDocuments documents) {
		this.clients = clients;
		this.authorizations = authorizations;
		this.documents = documents;
	}

	/** The app, or empty when no request of this person's waits with this client and state. */
	public Optional<ConnectingApp> waiting(UUID accountId, String clientId, String state) {
		RegisteredClient client = clients.findByClientId(clientId);
		OAuth2Authorization pending = authorizations.findByToken(state, STATE);
		if (client == null || pending == null || !pending.getRegisteredClientId().equals(client.getId())
				|| !pending.getPrincipalName().equals(accountId.toString())) {
			return Optional.empty();
		}
		OAuth2AuthorizationRequest request = pending.getAttribute(OAuth2AuthorizationRequest.class.getName());
		URI redirect = request == null ? null : uri(request.getRedirectUri());
		if (redirect == null) {
			return Optional.empty();
		}
		boolean own = clientId.equals(McpClients.CURSOR) || clientId.equals(McpClients.LOCAL);
		URI document = own ? null : uri(clientId);
		String host = document == null ? null : document.getHost().toLowerCase(Locale.ROOT);
		boolean local = clientId.equals(McpClients.LOCAL) || !"https".equals(redirect.getScheme());
		boolean reviewed = own ? !clientId.equals(McpClients.LOCAL) : host != null && documents.isReviewed(host);
		// A document on a host BeyondPilot has not reviewed may call itself anything, Claude included: its host is
		// what the person can trust, so it stands in for the name.
		String name = reviewed || own || host == null ? client.getClientName() : host;
		return Optional.of(new ConnectingApp(client.getClientId(), name, host,
				local ? null : redirect.getHost().toLowerCase(Locale.ROOT), local, reviewed,
				clientId.equals(McpClients.LOCAL)));
	}

	private static @Nullable URI uri(@Nullable String value) {
		if (value == null) {
			return null;
		}
		try {
			URI uri = new URI(value);
			return uri.getScheme() == null ? null : uri;
		}
		catch (URISyntaxException malformed) {
			return null;
		}
	}

	/**
	 * An app waiting for a person's answer.
	 * @param host where its client ID metadata document lives; null for a client BeyondPilot registered
	 * @param returnsTo the host the answer goes to; null when it goes to this computer
	 * @param local whether the answer goes to this computer, where any program could be listening
	 * @param reviewed whether BeyondPilot has reviewed its host, or registered it
	 * @param anyLocalApp whether it is the client any agent on a person's computer uses, which names no app
	 */
	public record ConnectingApp(String clientId, String name, @Nullable String host, @Nullable String returnsTo,
			boolean local, boolean reviewed, boolean anyLocalApp) {
	}

}
