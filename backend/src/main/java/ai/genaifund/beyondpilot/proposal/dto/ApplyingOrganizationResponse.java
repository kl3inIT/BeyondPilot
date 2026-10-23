package ai.genaifund.beyondpilot.proposal.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ApplyingOrganization", description = "The organization a person applies for.")
public record ApplyingOrganizationResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "company", "builder_team", "independent_builder",
				"other" }) String type,
		@Schema(types = { "string", "null" }) @Nullable String country,
		@Schema(types = { "string", "null" }) @Nullable String teamSize,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it is active, meaning not taken down.") boolean active,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the person may still change who applies: they apply as themselves or through a team that is just them, and nothing was sent under its name yet.") boolean changeable) {
}
