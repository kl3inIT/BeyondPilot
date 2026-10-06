package ai.genaifund.beyondpilot.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "SaveEmailAppearance", description = "What every email's layout takes from the settings.")
public record SaveEmailAppearanceRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "#0070C0") @NotNull @Pattern(regexp = "#[0-9A-Fa-f]{6}") String accentColor,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Plain text in the band at the bottom of every email.") @NotBlank @Size(max = 500) String footer,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The version the settings were read at.") long version) {
}
