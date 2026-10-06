package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "ApproveOrganization", description = """
		What an operator vouches for with an approval, of a new organization or of a claim to own one: the domain of \
		the organization's work addresses, or none.""")
public record ApproveOrganizationRequest(
		@Schema(types = { "string", "null" }, example = "tasco.com.vn",
				description = "The verified domain; null leaves the organization as it is.") @Size(max = 253) @Pattern(
						regexp = OrganizationCodes.DOMAIN) @Nullable String emailDomain) {
}
