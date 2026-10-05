package ai.genaifund.beyondpilot.program.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveProgram",
		description = "A program as the Settings screen holds it. Everything is saved together, and the lists are replaced as sent.")
public record SaveProgramRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The version the screen read; the save is refused when the program changed since.") @NotNull Long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address under /programs. It cannot change once the program has been published.") @NotNull @Size(
						min = 3, max = 60) @Pattern(regexp = CreateProgramRequest.SLUG) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "enterprise_challenge", "open_innovation_call", "accelerator", "hackathon",
						"buildathon", "grant", "venture_building", "pitch_competition", "event_series",
						"event" }) @NotNull @Pattern(regexp = CreateProgramRequest.TYPE) String type,
		@Schema(types = { "string", "null" }) @Size(max = 120) @Nullable String partnerName,
		@Schema(types = { "string", "null" }) @Size(max = 300) @Nullable String summary,
		@Schema(types = { "string", "null" }) @Size(max = 20000) @Nullable String about,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate startsOn,
		@Schema(types = { "string", "null" }, format = "date",
				description = "Not before `startsOn`.") @Nullable LocalDate endsOn,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "standard", "custom", "external" }) @NotNull @Pattern(
						regexp = "standard|custom|external") String pageKind,
		@Schema(types = { "string", "null" }, format = "uri",
				description = "Needed when `pageKind` is `external`.") @Size(max = 2000) @Pattern(
						regexp = WEB_ADDRESS) @Nullable String externalUrl,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "A stored `program_image` the caller uploaded, or the cover the program already has. Null removes the cover.") @Nullable UUID coverFileId,
		@Schema(description = "Null for a program that takes no applications here.") @Valid @Nullable ProgramApplications applications,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 30) List<@Valid @NotNull ProgramKeyDate> keyDates,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Size(
				max = 30) List<@Valid @NotNull ProgramEventEntry> events) {

	static final String WEB_ADDRESS = "https?://\\S+";
}
