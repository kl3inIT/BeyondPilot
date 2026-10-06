package ai.genaifund.beyondpilot.notification.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "EmailResent", description = "The new email, queued with the content of the one sent again.")
public record EmailResentResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id) {
}
