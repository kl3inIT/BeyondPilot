package ai.genaifund.beyondpilot.talent;

import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A person's talent profile as another module keeps it with a record of its own, such as a proposal: what the person
 * says about themselves, never what the profile keeps private (the rate band and whether it is listed) and never the
 * person's address.
 * @param complete whether it has what a proposal asks of its sender: a headline, a bio, a role and a skill
 * @param photoFileId the photo, read at the public address of stored files
 */
public record TalentSnapshot(String name, @Nullable String headline, @Nullable String bio, List<String> roles,
		List<String> skills, @Nullable String country, @Nullable String city, @Nullable String worksAt,
		List<String> languages, List<String> industries, List<String> engagement, @Nullable String website,
		@Nullable UUID photoFileId, List<Project> projects, boolean complete) {

	/** One piece of work the profile shows. */
	public record Project(String title, @Nullable String summary, @Nullable String url, @Nullable Integer year,
			@Nullable String stage) {
	}
}
