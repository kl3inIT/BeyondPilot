package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProgramDrafts",
		description = "A program's applications not submitted yet, for operators to follow up; what each says stays the applicant's.")
public record ProgramDraftsResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Item> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many required questions the program asks.") int requiredQuestions) {

	@Schema(name = "ProgramDraft", description = "Who started an application, how to reach them and how far they got.")
	public record Item(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(types = { "string", "null" }) @Nullable String firstName,
			@Schema(types = { "string", "null" }) @Nullable String lastName,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The address the applicant signs in with.") String email,
			@Schema(types = { "string", "null" }) @Nullable String phone,
			@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Nullable String country,
			@Schema(types = { "string", "null" },
					description = "The organization the applicant applies for, once they have one.") @Nullable String organizationName,
			@Schema(types = { "string", "null" }, allowableValues = { "company", "builder_team",
					"independent_builder", "other" }) @Nullable String organizationType,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "First and last name, phone and country are filled.") boolean contactComplete,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "A solution is chosen.") boolean solutionChosen,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "A deck is attached.") boolean deckAttached,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "How many of the program's required questions are answered.") int requiredAnswered,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant startedAt,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant lastSavedAt) {
	}
}
