package ai.genaifund.beyondpilot.identity.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ConnectingApp", description = "An AI app asking the signed-in person to connect it to BeyondPilot.")
public record ConnectingAppResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String clientId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The host the app's client ID belongs to, or `beyondpilot` for a client BeyondPilot registered.") String host) {
}
