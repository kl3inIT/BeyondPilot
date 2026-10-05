package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "JobTitle", description = "What the caller does in their organization; null or blank removes it.")
public record JobTitleRequest(@Schema(types = { "string", "null" }) @Size(max = 120) @Nullable String jobTitle) {
}
