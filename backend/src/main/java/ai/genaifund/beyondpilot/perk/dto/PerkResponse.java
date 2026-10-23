package ai.genaifund.beyondpilot.perk.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Perk", description = "A perk as its form reads it, with what it holds.")
public record PerkResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(types = { "string", "null" }) @Nullable String value,
		@Schema(types = { "string", "null" }) @Nullable String summary,
		@Schema(types = { "string", "null" }) @Nullable String about, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> steps,
		@Schema(types = { "string", "null" }) @Nullable String terms,
		@Schema(types = { "string", "null" }) @Nullable String termsUrl,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "everyone", "members", "applicants", "shortlisted" }) String audience,
		@Schema(types = { "string", "null" }, format = "uuid") @Nullable UUID programId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "link", "code", "codes", "request" }) String way,
		@Schema(types = { "string", "null" }) @Nullable String url,
		@Schema(types = { "string", "null" }) @Nullable String code,
		@Schema(types = { "string", "null" }) @Nullable String redeemUrl,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PerkQuestionEntry> questions, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean requireApproval,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean perPerson, @Schema(types = { "integer", "null" }) @Nullable Integer places,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant startsAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant endsAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UUID> solutionIds, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UUID> shownOnProgramIds,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean fromGenAiFund,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "draft", "published", "archived" }) String state,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "False for a member when GenAI Fund arranged it.") boolean editable,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many claims hold a place.") long taken,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many requests wait for an answer.") long waiting,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many codes it holds, for a perk given as a list.") int codesLoaded,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many of them are not given yet.") int codesLeft, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt) {
}
