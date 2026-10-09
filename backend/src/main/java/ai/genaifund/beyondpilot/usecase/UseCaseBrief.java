package ai.genaifund.beyondpilot.usecase;

import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.core.io.InputStreamSource;

/**
 * Everything a published use case says, for matching to read: what its public page shows, what it keeps for members,
 * the requirements its organization wrote and the files it attached. It is never sent to a browser as it is.
 * @param requirements what the organization listed as things the solution must do, in its order
 * @param attachments the attached files that are stored, in the order they were attached
 */
public record UseCaseBrief(UUID id, UUID organizationId, String title, @Nullable String industry,
		List<String> technologies, @Nullable String problemStatement, @Nullable String expectedOutcomes,
		@Nullable String currentProcess, @Nullable String currentSolutions, @Nullable String targetUsers,
		@Nullable String dataReadiness, @Nullable String integrationRequirements, List<Stated> requirements,
		List<Attachment> attachments) {

	/** One thing the organization wrote the solution must do. */
	public record Stated(String statement, boolean required) {
	}

	/** An attached file with its bytes. */
	public record Attachment(UUID fileId, String fileName, String mediaType, InputStreamSource content) {
	}

}
