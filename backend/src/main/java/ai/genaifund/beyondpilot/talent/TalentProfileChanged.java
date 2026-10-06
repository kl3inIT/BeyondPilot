package ai.genaifund.beyondpilot.talent;

import java.util.UUID;

/**
 * A talent profile was saved or deleted by its person, or decided on by GenAI Fund. It names the profile only: a
 * listener reads what it needs through {@link TalentDirectory#indexed(UUID)}, which is the profile as it is when the
 * listener runs, and empty once it is deleted.
 */
public record TalentProfileChanged(UUID profileId) {
}
