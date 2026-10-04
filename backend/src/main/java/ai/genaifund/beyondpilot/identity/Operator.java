package ai.genaifund.beyondpilot.identity;

import java.util.UUID;

/**
 * An operator as another module needs them to record who made a change.
 * @param label the name they are shown by: their name, or their address until they have one
 */
public record Operator(UUID accountId, String label, String email) {
}
