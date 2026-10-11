package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ReceivedUseCaseProposalSummary", description = "One line of the proposals a use case received.")
public record ReceivedUseCaseProposalSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(types = { "string", "null" }, format = "uuid", description = "Read at /api/storage/files/{id}.") @Nullable UUID organizationLogoFileId,
		@Schema(types = { "string", "null" }) @Nullable String solutionName,
		@Schema(types = { "string", "null" }, description = "The primary contact.") @Nullable String contactName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date-time") Instant sentAt) {
}
