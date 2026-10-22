package ai.genaifund.beyondpilot.identity.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Schema(name = "ConsentRequest",
		description = "The caller's choice for every purpose. Only a choice that differs from the current one, or that the current version asks again, is recorded.")
public record ConsentRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull Boolean platform,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull Boolean partners,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull Boolean ai,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull Boolean updates,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "accept_all", "choose", "settings", "undo", "application" },
				description = "Where the person made the choice; it is recorded with it.") @NotNull @Pattern(
						regexp = "^(accept_all|choose|settings|undo|application)$") String source) {
}
