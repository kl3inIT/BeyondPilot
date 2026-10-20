package ai.genaifund.beyondpilot.solution.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/**
 * The offers a download holds, as the operators' list shows them. The list is read whole and narrowed in the browser, so
 * the download takes the offers it shows, in its order, and names the filters only to say how the list was narrowed.
 */
@Schema(name = "ExportOffers", description = "The offers a download holds, in the order the list shows them.")
public record ExportOffersRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The offers, in the list's order; one that does not exist is left out.") @NotNull @Size(
						max = 10_000) List<UUID> ids,
		@Schema(types = { "string", "null" },
				description = "The state the list was narrowed to, said in the file.") @Size(max = 40) @Nullable String state,
		@Schema(types = { "string", "null" },
				description = "The search the list was narrowed by, said in the file.") @Size(max = 200) @Nullable String q) {
}
