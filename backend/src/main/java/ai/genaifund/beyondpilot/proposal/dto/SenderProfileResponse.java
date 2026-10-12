package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SenderProfile", description = "The sender's talent profile as it was when the proposal was sent.")
public record SenderProfileResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }) @Nullable String headline,
		@Schema(types = { "string", "null" }) @Nullable String bio,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> roles,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> skills,
		@Schema(types = { "string", "null" }, description = "ISO 3166-1 alpha-2.") @Nullable String country,
		@Schema(types = { "string", "null" }) @Nullable String city,
		@Schema(types = { "string", "null" }) @Nullable String worksAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "ISO 639-1 codes.") List<String> languages,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> industries,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> engagement,
		@Schema(types = { "string", "null" }) @Nullable String website,
		@Schema(types = { "string", "null" }, format = "uuid", description = "Read at /api/storage/files/{id}.") @Nullable UUID photoFileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Project> projects,
		@Schema(types = { "string", "null" }, description = "The sign-in address of the sender's account when the proposal is read; not part of the copy kept at sending.") @Nullable String email) {

	/** The same profile with the sender's address, read from the account when the proposal is shown. */
	public SenderProfileResponse withEmail(@Nullable String email) {
		return new SenderProfileResponse(name, headline, bio, roles, skills, country, city, worksAt, languages, industries,
				engagement, website, photoFileId, projects, email);
	}

	@Schema(name = "SenderProject", description = "One piece of work the profile showed.")
	public record Project(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
			@Schema(types = { "string", "null" }) @Nullable String summary,
			@Schema(types = { "string", "null" }) @Nullable String url,
			@Schema(types = { "integer", "null" }, format = "int32") @Nullable Integer year,
			@Schema(types = { "string", "null" }) @Nullable String stage) {
	}
}
