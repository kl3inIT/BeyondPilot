package ai.genaifund.beyondpilot.organization;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * An organization as another module shows it next to its own records.
 * @param country ISO 3166-1 alpha-2, or null when unknown
 * @param logoFileId its logo, read at the public address of stored files; null when it has none
 * @param individual whether it is a builder on their own, shown as its person and without a page of its own
 */
public record OrganizationName(UUID id, String slug, String name, @Nullable String country,
		@Nullable UUID logoFileId, boolean individual) {
}
