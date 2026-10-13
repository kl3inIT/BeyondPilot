package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "UseCaseProposal", description = "An organization's proposal to a use case as its members see it: the working copy, or the proposal as sent.")
public record UseCaseProposalResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "draft", "sent" }, description = "A proposal that was taken back is a draft again, and says when in `withdrawnAt`.") String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The solutions offered, in the order shown.") List<ProposalSolutionResponse> solutions,
		@Schema(types = { "string", "null" }) @Nullable String approach,
		@Schema(types = { "object", "null" }) @Nullable AttachedFileResponse deck,
		@Schema(types = { "string", "null" }) @Nullable String teamBackground,
		@Schema(types = { "object", "null" },
				description = "The sender's talent profile as it was when the proposal was sent; null for a draft and for a proposal sent without it, as every new one is.") @Nullable SenderProfileResponse sender,
		@Schema(types = { "object", "null" }, description = "Who sent it; null for a draft.") @Nullable SentByResponse sentBy,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant sentAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "While a sent proposal may still be edited, until when; null for a draft, and once the time to edit has ended or the use case has closed.") @Nullable Instant editableUntil,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When the proposal was last edited after sending; null while it is as sent.") @Nullable Instant editedAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When the proposal was taken back; null if it never was, and once it is sent again.") @Nullable Instant withdrawnAt,
		@Schema(types = { "string", "null" }, allowableValues = { "shortlisted", "declined" },
				description = "The decision the posting organization last told the sender; null until the outcomes were sent.") @Nullable String outcome,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When the sender was told `outcome`.") @Nullable Instant outcomeSentAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64",
				description = "Sent back with the next save, so a save made on a stale copy is refused.") long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date-time") Instant updatedAt) {
}
