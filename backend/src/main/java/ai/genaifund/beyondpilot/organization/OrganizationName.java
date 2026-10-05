package ai.genaifund.beyondpilot.organization;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * An organization as another module shows it next to its own records.
 * @param country ISO 3166-1 alpha-2, or null when unknown
 */
public record OrganizationName(UUID id, String slug, String name, @Nullable String country) {
}
