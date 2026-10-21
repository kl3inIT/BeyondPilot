package ai.genaifund.beyondpilot.proposal.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProposingOrganization", description = "The organization the caller sends a proposal for.")
public record ProposingOrganizationResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }, format = "uuid", description = "Read at /api/storage/files/{id}.") @Nullable UUID logoFileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether it is active, meaning not taken down.") boolean active,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "company", "builder_team",
				"independent_builder", "other" }, description = "What kind of organization it is; a team writes what it has done.") String type,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the caller is an owner of it, who may correct what they gave when they made it.") boolean owner,
		@Schema(types = { "string", "null" }) @Nullable String teamBackground) {
}
