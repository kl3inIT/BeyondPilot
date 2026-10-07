package ai.genaifund.beyondpilot.usecase.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(name = "SetUseCasePrograms", description = "The programs a use case belongs to, replacing those it had.")
public record SetUseCaseProgramsRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
		description = "Empty for none.") @NotNull @Size(max = 10) List<@NotNull UUID> programIds) {
}
