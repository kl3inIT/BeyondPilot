package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ReceivedUseCaseProposalSummary", description = "One line of the proposals a use case received.")
public record ReceivedUseCaseProposalSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The sending organization.") UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(types = { "string", "null" }, format = "uuid", description = "Read at /api/storage/files/{id}.") @Nullable UUID organizationLogoFileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The names of the solutions offered.") List<String> solutionNames,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether GenAI Fund approved the sending organization.") boolean organizationApproved,
		@Schema(types = { "string", "null" }, description = "Who sent it.") @Nullable String contactName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date-time") Instant sentAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When the sending organization last edited the proposal after sending it; null while it is as sent.") @Nullable Instant editedAt,
		@Schema(types = { "string", "null" }, allowableValues = { "shortlisted", "declined" },
				description = "What the posting organization decided; null while undecided.") @Nullable String decision,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant decidedAt,
		@Schema(types = { "string", "null" }, description = "Who made the latest decision.") @Nullable String decidedBy,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the decision is set and the sender was not yet told it.") boolean outcomePending,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When the sender was last e-mailed the outcome; null if never.") @Nullable Instant outcomeSentAt) {
}
