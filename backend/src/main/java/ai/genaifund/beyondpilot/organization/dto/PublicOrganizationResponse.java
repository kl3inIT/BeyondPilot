package ai.genaifund.beyondpilot.organization.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PublicOrganization", description = "An approved organization as anyone reads it.")
public record PublicOrganizationResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) String type,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Nullable String country,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> industries,
		@Schema(types = { "string", "null" }) @Nullable String website,
		@Schema(types = { "string", "null" }) @Nullable String description,
		@Schema(types = { "string", "null" },
				description = "Its logo, read at /api/storage/files/{id}; null for none.") @Nullable UUID logoFileId) {
}
