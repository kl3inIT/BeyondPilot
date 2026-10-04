package ai.genaifund.beyondpilot.storage.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UploadTicket",
		description = "Permission to send the bytes of one file. Send them as the request says, then confirm.")
public record UploadTicketResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The file, pending until confirmed.") UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "PUT") String method,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Where to send the bytes: an address of the object store, or a path of this application.") String url,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The headers the request must carry.") Map<String, String> headers,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "When the permission ends.") Instant expiresAt) {
}
