package ai.genaifund.beyondpilot.talent;

import java.util.UUID;

/**
 * The person behind a profile in the directory, as a module that carries a message to them needs it: who they are
 * shown as and which account reads what is written.
 */
public record TalentRecipient(UUID profileId, String name, UUID accountId) {
}
