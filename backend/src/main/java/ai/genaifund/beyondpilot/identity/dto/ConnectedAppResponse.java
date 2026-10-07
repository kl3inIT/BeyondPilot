package ai.genaifund.beyondpilot.identity.dto;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ConnectedApp", description = "An AI app the signed-in person connected to BeyondPilot.")
public record ConnectedAppResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "What a revoke names.") String id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String clientId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The app's name; its host when BeyondPilot has not reviewed the host.") String name,
		@Schema(types = { "string", "null" },
				description = "The host the app's metadata document lives on; null for a client BeyondPilot registered.") @Nullable String host,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether BeyondPilot has reviewed the app's host or registered the app.") boolean reviewed,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "user", "operator" },
				description = "The servers the app may call: `user` for /mcp, `operator` for /mcp/operator.") List<String> servers,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When the person first allowed it.") @Nullable Instant allowedAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When it last got a token, which it does only while in use, so within the hour of its last use.") @Nullable Instant usedAt) {
}
