package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "Decide", description = "GenAI Fund's decision on one application or several of a program.")
public record DecideRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotEmpty @Size(max = 500) List<@NotNull UUID> applicationIds,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "shortlisted", "not_selected" }) @NotNull @Pattern(
				regexp = "shortlisted|not_selected") String decision,
		@Schema(types = { "string", "null" }, description = "Private; the applicant never sees it.") @Size(
				max = 1000) @Nullable String reason) {
}
