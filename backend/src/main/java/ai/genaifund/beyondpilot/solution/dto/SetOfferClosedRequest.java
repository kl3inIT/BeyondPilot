package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import org.jspecify.annotations.Nullable;

@Schema(name = "SetOfferClosedRequest", description = "Closes an offer to new solutions, or opens it again.")
public record SetOfferClosedRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "True to close it, false to open it. Asking for the state it has changes nothing.") @NotNull Boolean closed,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The version the form read; the change is refused when the offer changed since.") @Nullable Long version) {
}
