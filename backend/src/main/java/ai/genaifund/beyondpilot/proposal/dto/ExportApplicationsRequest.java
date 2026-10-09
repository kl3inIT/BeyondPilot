package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "ExportApplicationsRequest", description = "Which of a program's submitted applications to download.")
public record ExportApplicationsRequest(
		@Schema(types = { "array", "null" },
				description = "Only these applications, as the list was narrowed; left out, every submitted application.") @Size(
						max = 5000) @Nullable List<UUID> applicationIds) {
}
