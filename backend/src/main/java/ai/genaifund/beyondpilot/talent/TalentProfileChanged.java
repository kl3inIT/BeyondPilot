package ai.genaifund.beyondpilot.talent;

import java.util.UUID;

/**
 * A talent profile was saved by its person, approved, or rejected. It names the profile only: a listener reads what it
 * needs through {@link TalentDirectory#indexed(UUID)}, which is the profile as it is when the listener runs.
 */
public record TalentProfileChanged(UUID profileId) {
}
