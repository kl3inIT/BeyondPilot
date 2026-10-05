package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "JoinOrganization", description = "What a person says with a request to join or to claim.")
public record JoinOrganizationRequest(
		@Schema(types = { "string", "null" }) @Size(max = 1000) @Nullable String message) {
}
