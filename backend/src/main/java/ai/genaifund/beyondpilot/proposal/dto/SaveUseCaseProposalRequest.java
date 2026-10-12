package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveUseCaseProposal", description = "What the proposal form holds now. Nothing is required until the proposal is sent.")
public record SaveUseCaseProposalRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Solutions of the caller's organization, whatever their review says, in the order shown.") @NotNull @Size(max = 10) List<@NotNull UUID> solutionIds,
		@Schema(types = { "string", "null" }, description = "How the solutions solve this use case.") @Size(max = 2000) @Nullable String approach,
		@Schema(types = { "string", "null" }, format = "uuid", description = "A PDF the caller uploaded for an application.") @Nullable UUID deckFileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The people named, in the order shown; at most one is primary. The team may be empty.") @NotNull @Size(max = 20) List<@Valid @NotNull TeamMemberRequest> team,
		@Schema(types = { "integer", "null" }, format = "int64",
				description = "The version the form read; null when the proposal does not exist yet.") @Nullable Long version) {
}
