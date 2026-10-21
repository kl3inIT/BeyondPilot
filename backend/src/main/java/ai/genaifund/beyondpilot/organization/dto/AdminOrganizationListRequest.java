package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the operators' list of organizations. Every member is optional. */
public record AdminOrganizationListRequest(
		@Parameter(description = "Organizations whose name or domain contains this, ignoring case.") @Size(
				max = 100) @Nullable String q,
		@Parameter(description = "Only organizations in this state: `active` leaves out those taken down, `claimed` selects those with an open ownership claim, and `suspended` selects those taken down. Merged organizations are listed only under `merged`.",
				schema = @Schema(allowableValues = { "active", "claimed", "suspended", "merged" })) @Pattern(
						regexp = "active|claimed|suspended|merged") @Nullable String status,
		@Parameter(description = "Only organizations in this country, ISO 3166-1 alpha-2.") @Pattern(
				regexp = OrganizationCodes.COUNTRY) @Nullable String country,
		@Parameter(
				description = "The order: `name` by the name, `created` by when the organization was created, "
						+ "`members` by how many people belong to it; `-` before a key turns it round. Without it, "
						+ "those with an open claim first, then the most recent by its claim or, with none open, "
						+ "by its creation.",
				schema = @Schema(type = "string", allowableValues = { "name", "-name", "created", "-created",
						"members", "-members" })) @Pattern(regexp = "-?(name|created|members)") @Nullable String sort,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page,
		@Parameter(description = "How many items a page holds; the list's own page size when absent.",
				schema = @Schema(type = "integer", format = "int32", minimum = "1", maximum = "100")) @Min(1) @Max(
						100) @Nullable Integer size) {
}
