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
				description = "Whether it is not taken down.") boolean approved,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the person applies as themselves and may still apply as a team or a company instead: nothing was sent under their name yet.") boolean changeable) {
}
