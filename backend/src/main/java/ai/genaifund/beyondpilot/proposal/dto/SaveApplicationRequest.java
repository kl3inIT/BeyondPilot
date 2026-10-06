package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveApplication", description = "What the application form holds now. Nothing is checked for completeness until it is submitted.")
public record SaveApplicationRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Valid ContactDetails contact,
		@Schema(types = { "string", "null" },
				description = "The experience that matters for the problem; asked of a team or a company.") @Size(
						max = 2000) @Nullable String teamBackground,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "A solution of the applicant's organization.") @Nullable UUID solutionId,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The solution's deck for this application: a PDF the applicant uploaded for `application_file`.") @Nullable UUID deckFileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The models, tools and frameworks the solution is built with.") @NotNull @Size(
						max = 10) List<@NotBlank @Size(max = 60) String> builtWith,
		@Schema(types = { "string", "null" },
				description = "Customers, pilots, users or revenue so far.") @Size(max = 600) @Nullable String traction,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The answers to the program's questions by question identifier. A file is named by its identifier, a confirmation is \"true\".") @NotNull @Size(
						max = 20) Map<UUID, @NotNull @Size(max = 4000) String> answers,
		@Schema(types = { "integer", "null" }, format = "int64",
				description = "The version the form read; null for the first save.") @Nullable Long version) {
}
