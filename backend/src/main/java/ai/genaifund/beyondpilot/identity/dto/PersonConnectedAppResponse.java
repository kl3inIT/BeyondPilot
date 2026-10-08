package ai.genaifund.beyondpilot.identity.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PersonConnectedApp", description = "An AI app someone connected to BeyondPilot, as operators see it.")
public record PersonConnectedAppResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID accountId,
		@Schema(types = { "string", "null" }, description = "Null until the person gives a name.") @Nullable String personName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String personEmail,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether the person is an operator.") boolean operator,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "What a revoke names, with the account.") String id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String clientId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The app's name; its host when BeyondPilot has not reviewed the host.") String name,
		@Schema(types = { "string", "null" },
				description = "The host the app's metadata document lives on; null for a client BeyondPilot registered.") @Nullable String host,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether BeyondPilot has reviewed the app's host or registered the app.") boolean reviewed,
		@ArraySchema(arraySchema = @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The servers the app may call: `user` for /mcp, `operator` for /mcp/operator."),
				schema = @Schema(allowableValues = { "user", "operator" })) List<String> servers,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When the person first allowed it.") @Nullable Instant allowedAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When it last got a token, which it does only while in use, so within the hour of its last use.") @Nullable Instant usedAt) {
}
