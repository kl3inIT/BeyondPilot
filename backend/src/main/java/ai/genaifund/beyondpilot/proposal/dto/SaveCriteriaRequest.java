package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveReviewCriteria", description = "A program's judging criteria, replaced whole, in order.")
public record SaveCriteriaRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(max = 12) List<@Valid @NotNull Criterion> criteria) {

	@Schema(name = "SaveReviewCriterion")
	public record Criterion(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 80) String name,
			@Schema(types = { "string", "null" }) @Size(max = 300) @Nullable String description) {
	}
}
