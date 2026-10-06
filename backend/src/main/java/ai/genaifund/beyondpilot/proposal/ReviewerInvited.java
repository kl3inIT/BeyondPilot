package ai.genaifund.beyondpilot.proposal;

import java.time.Instant;
import java.util.UUID;

/**
 * An address was invited to judge a program's applications, or the invitation was sent again.
 * @param inviterName who invited them, as they are shown
 */
record ReviewerInvited(UUID reviewerId, String email, String programName, String inviterName, Instant expiresAt) {
}
