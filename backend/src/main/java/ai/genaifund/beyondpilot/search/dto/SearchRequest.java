package ai.genaifund.beyondpilot.search.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/**
 * What a visitor searches for, and which part of the results they look at. Results past page 50 are not worth reading;
 * a person refines the query instead.
 */
public record SearchRequest(
		@Parameter(description = "What to search for, as the person typed it.", required = true) @NotBlank @Size(min = 1,
				max = 100) String q,
		@Parameter(description = "Only items of this kind; every kind when absent.",
				schema = @Schema(allowableValues = { "program", "solution", "talent", "use_case" })) @Pattern(
						regexp = "program|solution|talent|use_case") @Nullable String kind,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1",
						maximum = "50")) @Min(1) @Max(50) @Nullable Integer page,
		@Parameter(description = "How many items a page holds; the list's own page size when absent.",
				schema = @Schema(type = "integer", format = "int32", minimum = "1", maximum = "100")) @Min(1) @Max(
						100) @Nullable Integer size,
		@Parameter(description = "Only items filed under any of these industry codes.") @Size(max = 23) @Nullable List<@NotBlank @Pattern(regexp = "[a-z][a-z0-9_]{0,59}") String> industry,
		@Parameter(description = "Only solutions with this focus area.") @Pattern(regexp = "[a-z][a-z0-9_]{0,59}") @Nullable String focusArea,
		@Parameter(description = "Only solutions of this maturity.",
				schema = @Schema(allowableValues = { "idea", "prototype", "pilot", "production", "scaled" })) @Pattern(regexp = "idea|prototype|pilot|production|scaled") @Nullable String maturity,
		@Parameter(description = "Only talent with this role.") @Pattern(regexp = "[a-z][a-z0-9_]{0,59}") @Nullable String role,
		@Parameter(description = "Only programs of this type.") @Pattern(regexp = "enterprise_challenge|open_innovation_call|accelerator|hackathon|buildathon|grant|venture_building|pitch_competition|event_series|event") @Nullable String type,
		@Parameter(description = "Only programs in this phase; open includes running.",
				schema = @Schema(allowableValues = { "open", "upcoming", "done" })) @Pattern(regexp = "open|upcoming|done") @Nullable String phase,
		@Parameter(description = "Relevance by default; a directory's explicit order otherwise.",
				schema = @Schema(allowableValues = { "relevance", "newest", "name", "deadline", "budget" }, defaultValue = "relevance")) @Pattern(regexp = "relevance|newest|name|deadline|budget") @Nullable String sort) {

	@AssertTrue(message = "must be an order supported by the selected kind")
	@Schema(hidden = true)
	@Parameter(hidden = true)
	public boolean isSortValid() {
		if (sort == null || "relevance".equals(sort)) {
			return true;
		}
		if ("use_case".equals(kind)) {
			return "newest".equals(sort) || "deadline".equals(sort) || "budget".equals(sort);
		}
		return kind != null && ("newest".equals(sort) || "name".equals(sort));
	}

	public static Builder builder(String q) {
		return new Builder(q);
	}

	public static final class Builder {

		private final String q;
		private @Nullable String kind;
		private @Nullable Integer page;
		private @Nullable Integer size;
		private @Nullable List<String> industry;
		private @Nullable String focusArea;
		private @Nullable String maturity;
		private @Nullable String role;
		private @Nullable String type;
		private @Nullable String phase;
		private @Nullable String sort;

		private Builder(String q) {
			this.q = q;
		}

		public Builder kind(@Nullable String value) {
			kind = value;
			return this;
		}

		public Builder page(@Nullable Integer value) {
			page = value;
			return this;
		}

		public Builder size(@Nullable Integer value) {
			size = value;
			return this;
		}

		public Builder industry(@Nullable List<String> value) {
			industry = value;
			return this;
		}

		public Builder focusArea(@Nullable String value) {
			focusArea = value;
			return this;
		}

		public Builder maturity(@Nullable String value) {
			maturity = value;
			return this;
		}

		public Builder role(@Nullable String value) {
			role = value;
			return this;
		}

		public Builder type(@Nullable String value) {
			type = value;
			return this;
		}

		public Builder phase(@Nullable String value) {
			phase = value;
			return this;
		}

		public Builder sort(@Nullable String value) {
			sort = value;
			return this;
		}

		public SearchRequest build() {
			return new SearchRequest(q, kind, page, size, industry, focusArea, maturity, role, type, phase, sort);
		}
	}
}
