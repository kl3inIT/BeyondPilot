package ai.genaifund.beyondpilot.identity;

import java.util.UUID;

/**
 * A person agreed to a purpose or declined it, published in the transaction that recorded it. The choice itself is read
 * again through {@link IdentityService#declined} where it matters.
 * @param withdrawal whether the person had agreed to the purpose and has now declined it
 */
public record ConsentChanged(UUID accountId, ConsentPurpose purpose, boolean granted, boolean withdrawal) {
}
