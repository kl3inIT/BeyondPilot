package ai.genaifund.beyondpilot.organization.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "OrganizationMatch", description = "An organization a person may get into, and how.")
public record OrganizationMatchResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "company", "builder_team", "independent_builder", "other" }) String type,
		@Schema(types = { "string", "null" }) @Nullable String country,
		@Schema(types = { "string", "null" }) @Nullable String emailDomain,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "Its logo, read at /api/storage/files/{id}; null for none.") @Nullable UUID logoFileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "join", "request", "claim" },
				description = """
						What asking to get in does for this caller: `join` makes them a member at once, \
						`request` asks its owners, `claim` asks GenAI Fund to let them own it, which is the only \
						way into an organization nobody owns.""") String way) {
}
