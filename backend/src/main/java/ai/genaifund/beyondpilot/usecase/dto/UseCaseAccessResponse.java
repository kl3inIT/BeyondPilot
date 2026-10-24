package ai.genaifund.beyondpilot.usecase.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UseCaseAccess", description = "Who may do what with one use case.")
public record UseCaseAccessResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "viewer", "editor", "full_access" },
				description = "What the caller may do with the use case. Only full access changes who else may.") String yourAccess,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "none", "viewer", "editor", "full_access" },
				description = "What every other member of the organization may do with it.") String memberAccess,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The creator, the owners and everyone given access, the creator first.") List<UseCaseAccessPersonResponse> people,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The members of the organization who have no access of their own yet.") List<UseCaseAccessCandidateResponse> candidates) {
}
