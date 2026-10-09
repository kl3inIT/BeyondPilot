package ai.genaifund.beyondpilot.identity.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ConnectingApp", description = "An AI app waiting for the signed-in person to allow or deny it.")
public record ConnectingAppResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String clientId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" },
				description = "The host the app's metadata document lives on; null for a client BeyondPilot registered.") @Nullable String host,
		@Schema(types = { "string", "null" },
				description = "The host the answer goes to; null when it goes to this computer.") @Nullable String returnsTo,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the answer goes to this computer, where any program could be listening.") boolean local,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether BeyondPilot has reviewed the app's host or registered the app.") boolean reviewed,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it is the client any agent on a person's computer uses, which names no app.") boolean anyLocalApp) {
}
