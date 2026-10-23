package ai.genaifund.beyondpilot.perk;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import ai.genaifund.beyondpilot.perk.dto.PerkClaimResponse;
import ai.genaifund.beyondpilot.perk.dto.PerkQuestionEntry;
import ai.genaifund.beyondpilot.perk.persistence.Perk;
import ai.genaifund.beyondpilot.perk.persistence.PerkClaim;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Reads and writes the JSON a perk keeps its steps and questions in, and a claim its answers. */
@Component
class PerkViews {

	private static final TypeReference<List<String>> STEPS = new TypeReference<>() {
	};

	private static final TypeReference<List<PerkQuestionEntry>> QUESTIONS = new TypeReference<>() {
	};

	private static final TypeReference<Map<String, String>> ANSWERS = new TypeReference<>() {
	};

	private static final int MAX_SLUG_LENGTH = 100;

	private final JsonMapper json;

	PerkViews(JsonMapper json) {
		this.json = json;
	}

	List<String> steps(Perk perk) {
		return json.readValue(perk.getSteps(), STEPS);
	}

	/** The questions as stored: each with its identifier. */
	List<PerkQuestionEntry> questions(Perk perk) {
		return json.readValue(perk.getQuestions(), QUESTIONS);
	}

	Map<String, String> answers(PerkClaim claim) {
		return json.readValue(claim.getAnswers(), ANSWERS);
	}

	String write(Object value) {
		return json.writeValueAsString(value);
	}

	/**
	 * What a claim holds, as the person who made it and their team read it: the code it got, the partner's page for a
	 * link, and where a code is redeemed.
	 */
	static PerkClaimResponse claim(Perk perk, PerkClaim claim, String takenBy) {
		return new PerkClaimResponse(claim.getId(), claim.getState(), claim.getCode(),
				Perk.LINK.equals(perk.getWay()) ? perk.getUrl() : null,
				claim.getCode() == null ? null : perk.getRedeemUrl(), takenBy, claim.getCreatedAt(),
				claim.getDecidedAt());
	}

	/** What a person typed, or null when they typed nothing. */
	static @Nullable String text(@Nullable String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

	/** What a person typed as one line: trimmed, with every run of white space made one space. */
	static String line(String value) {
		return value.strip().replaceAll("\\s+", " ");
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
			return "perk";
		}
		return ascii.length() > MAX_SLUG_LENGTH ? ascii.substring(0, MAX_SLUG_LENGTH).replaceAll("-+$", "") : ascii;
	}
}
