package ai.genaifund.beyondpilot.organization;

import java.util.UUID;

/**
 * An operator merged a duplicate organization into the one kept. It is published inside the merge transaction, so a
 * module that keeps records of organizations moves them there with a synchronous listener, and the merge fails whole
 * when one cannot.
 * @param organizationId the duplicate, which only says where it went from now on
 * @param intoId the organization kept
 */
public record OrganizationMerged(UUID organizationId, UUID intoId) {
}
