package ai.genaifund.beyondpilot.talent.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import org.jspecify.annotations.Nullable;

/** Which page of the reported messages operators read. */
public record AdminTalentEnquiryListRequest(@Parameter(description = "The page, counted from 1.",
		schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page) {
}
