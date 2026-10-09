package ai.genaifund.beyondpilot.matching;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Judged;
import ai.genaifund.beyondpilot.matching.persistence.MatchingRepository.Requirement;
import org.jspecify.annotations.Nullable;

/**
 * What code makes of the model's answer for one candidate. A finding whose quote is in no source is lowered to "not
 * shown"; then the group is decided by GenAI Fund's rule, strongest first. Code only lowers what the model said.
 * <ul>
 * <li>Direct: every required capability is met.</li>
 * <li>Industry: a similar workflow delivered in the use case's industry, and at least one required capability
 * shown.</li>
 * <li>Technology: the named technology with at least one required capability shown, or half of the required
 * capabilities met.</li>
 * </ul>
 * A constraint is reported and never decides the group.
 */
final class Buckets {

	static final String DIRECT = "direct";

	static final String INDUSTRY = "industry";

	static final String TECHNOLOGY = "technology";

	static final String NONE = "none";

	private Buckets() {
	}

	static Judged settle(Judgment judgment, List<Requirement> requirements, Sources sources, String fingerprint) {
		Map<String, Judgment.Finding> answered = new LinkedHashMap<>();
		if (judgment.findings() != null) {
			for (Judgment.Finding finding : judgment.findings()) {
				if (finding != null && finding.requirementId() != null) {
					answered.putIfAbsent(finding.requirementId().strip(), finding);
				}
			}
		}
		List<Map<String, Object>> findings = new ArrayList<>();
		int required = 0;
		int met = 0;
		int shown = 0;
		for (Requirement requirement : requirements) {
			Judgment.Finding finding = answered.get(requirement.name());
			Map<String, Object> settled = settled(finding == null ? null : finding.status(),
					finding == null ? null : finding.quote(), finding == null ? null : finding.source(), sources);
			settled.put("requirement", requirement.position());
			findings.add(settled);
			if (requirement.isCapability() && requirement.isRequired()) {
				required++;
				Object status = settled.get("status");
				if (Judgment.MET.equals(status)) {
					met++;
				}
				if (!Judgment.NOT_SHOWN.equals(status)) {
					shown++;
				}
			}
		}
		Map<String, Object> industry = settled(judgment.industryFit(), sources);
		Map<String, Object> technology = settled(judgment.technologyFit(), sources);
		String bucket;
		if (required > 0 && met == required) {
			bucket = DIRECT;
		}
		else if (Judgment.MET.equals(industry.get("status")) && shown > 0) {
			bucket = INDUSTRY;
		}
		else if ((Judgment.MET.equals(technology.get("status")) && shown > 0) || (required > 0 && met * 2 >= required)) {
			bucket = TECHNOLOGY;
		}
		else {
			bucket = NONE;
		}
		Map<String, Object> stored = new LinkedHashMap<>();
		stored.put("requirements", findings);
		stored.put("industry", industry);
		stored.put("technology", technology);
		String summary = judgment.summary() == null || judgment.summary().isBlank() ? null : judgment.summary().strip();
		return new Judged(bucket, met, required, stored, summary, sources.unread(), fingerprint);
	}

	private static Map<String, Object> settled(Judgment.@Nullable Fit fit, Sources sources) {
		return fit == null ? settled(null, null, null, sources) : settled(fit.status(), fit.quote(), fit.source(), sources);
	}

	/** One answer as it is kept: the status after the check, the quote, its source and where the quote stands. */
	private static Map<String, Object> settled(@Nullable String status, @Nullable String quote, @Nullable String source,
			Sources sources) {
		boolean claimed = Judgment.MET.equals(status) || Judgment.PARTLY.equals(status);
		String state = claimed ? Quotes.state(quote, source, sources.texts()) : Quotes.NONE;
		boolean stands = claimed && Quotes.stands(state);
		Map<String, Object> settled = new LinkedHashMap<>();
		settled.put("status", stands ? status : Judgment.NOT_SHOWN);
		settled.put("quote", stands && quote != null ? quote.strip() : "");
		settled.put("source", stands && source != null ? source.strip() : "");
		settled.put("quoteState", state);
		return settled;
	}

}
