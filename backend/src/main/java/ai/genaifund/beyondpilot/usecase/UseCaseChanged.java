package ai.genaifund.beyondpilot.usecase;

import java.util.UUID;

/**
 * A use case was created, saved, sent, approved, sent back or taken back to a draft. It names the use case only: a
 * listener reads what it needs through {@link UseCaseDirectory#indexed(UUID)}, the use case as it is when the listener
 * runs.
 */
public record UseCaseChanged(UUID useCaseId) {
}
