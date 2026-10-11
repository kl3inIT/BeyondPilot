package ai.genaifund.beyondpilot.proposal.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProposalSolution", description = "A solution a proposal offers.")
public record ProposalSolutionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }) @Nullable String summary,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Opens its page at /solutions/shared/{viewKey} for whoever holds the link, whatever its review says.") UUID viewKey,
		@Schema(types = { "string", "null" },
				description = "The address of its public page at /solutions/{slug}; set only while it is approved and not taken down.") @Nullable String slug,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "Its logo, or its organization's when it has none; read at /api/storage/files/{id}.") @Nullable UUID logoFileId) {
}
