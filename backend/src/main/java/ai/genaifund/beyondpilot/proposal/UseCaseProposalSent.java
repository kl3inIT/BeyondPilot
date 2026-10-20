package ai.genaifund.beyondpilot.proposal;

import java.util.UUID;

/**
 * A proposal to a use case was sent, or one that was sent was edited: what the organization that posted the use case
 * reads of it changed. A listener reads the proposal as it is through {@link UseCaseProposals#sentTo(UUID)}.
 */
public record UseCaseProposalSent(UUID useCaseId, UUID proposalId) {
}
