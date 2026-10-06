package ai.genaifund.beyondpilot.talent;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

import ai.genaifund.beyondpilot.talent.dto.TalentProfileResponse;
import ai.genaifund.beyondpilot.talent.dto.TalentProjectDto;
import ai.genaifund.beyondpilot.talent.persistence.TalentDetailRepository;
import ai.genaifund.beyondpilot.talent.persistence.TalentProfile;
import org.jspecify.annotations.Nullable;

/** What the application services of the module derive the same way: the response records and a slug. */
final class TalentViews {

	private static final int MAX_SLUG_LENGTH = 60;

	private TalentViews() {
	}

	static TalentProfileResponse profile(TalentProfile profile, List<TalentDetailRepository.Project> projects) {
		return new TalentProfileResponse(profile.getId(), profile.getSlug(), profile.getName(), profile.getHeadline(),
				profile.getBio(), profile.getRoles(), profile.getSkills(), profile.getCountry(),
				profile.getEngagement(), profile.getRateBand(), profile.getWebsite(),
				profile.getPhotoFileId(), profile.getCity(), profile.getLanguages(), profile.getIndustries(),
				profile.getWorksAt(), projects(projects), profile.getStatus(), profile.getDecisionReason(), profile.getDecisionMessage(),
				profile.isListed(), profile.isComplete(), profile.getSubmittedAt(), profile.getVersion(),
				profile.getUpdatedAt());
	}

	static List<TalentProjectDto> projects(List<TalentDetailRepository.Project> projects) {
		return projects.stream()
			.map(project -> new TalentProjectDto(project.title(), project.summary(), project.url(), project.year(),
					project.stage()))
			.toList();
	}

	/** The values once each, in the order they were given, without the space around them. */
	static List<String> distinct(List<String> values) {
		return values.stream().map(String::strip).distinct().toList();
	}

	/** What a person typed, or null when they typed nothing. */
	static @Nullable String text(@Nullable String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

	/** An address for the name: its letters and digits in lowercase, joined by hyphens. */
	static String slug(String name) {
		String ascii = Normalizer.normalize(name, Normalizer.Form.NFD)
			.replaceAll("\\p{M}", "")
			.replace('đ', 'd')
			.replace('Đ', 'D')
			.toLowerCase(Locale.ROOT)
			.replaceAll("[^a-z0-9]+", "-")
			.replaceAll("(^-+)|(-+$)", "");
		if (ascii.isEmpty()) {
			return "talent";
		}
		return ascii.length() > MAX_SLUG_LENGTH ? ascii.substring(0, MAX_SLUG_LENGTH).replaceAll("-+$", "") : ascii;
	}
}
