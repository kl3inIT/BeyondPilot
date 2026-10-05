package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(name = "AutoJoin", description = "Whether an address on the organization's domain joins without asking.")
public record AutoJoinRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull Boolean autoJoin) {
}
