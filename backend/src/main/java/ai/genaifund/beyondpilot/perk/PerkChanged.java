package ai.genaifund.beyondpilot.perk;

import java.util.List;
import java.util.UUID;

/**
 * A perk changed in a way the cards of solutions show: it was published, saved, archived or deleted, or the solutions
 * it goes with changed.
 * @param solutionIds the solutions it went with before the change and goes with after it
 */
public record PerkChanged(UUID perkId, List<UUID> solutionIds) {
}
