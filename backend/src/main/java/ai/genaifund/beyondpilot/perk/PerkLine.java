package ai.genaifund.beyondpilot.perk;

import org.jspecify.annotations.Nullable;

/**
 * A perk as the card of a solution it goes with shows it: one line, and the page it leads to.
 * @param value the figure the perk is worth, such as "$1,000"; null when its partner gave none
 * @param fromGenAiFund whether GenAI Fund arranged it, which the card marks
 */
public record PerkLine(String slug, String title, @Nullable String value, boolean fromGenAiFund) {
}
