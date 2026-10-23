package ai.genaifund.beyondpilot.program;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import ai.genaifund.beyondpilot.program.dto.RegisterForEventRequest;
import ai.genaifund.beyondpilot.program.luma.LumaApi;
import ai.genaifund.beyondpilot.program.luma.LumaForm;
import ai.genaifund.beyondpilot.program.luma.LumaQuestion;
import org.jspecify.annotations.Nullable;
import tools.jackson.databind.json.JsonMapper;

/**
 * The answers of a registration, checked against the event's questions as they stand (BEY-245). Luma stores an answer
 * missing or an option it does not offer without a word, so BeyondPilot checks them itself: what is required is there,
 * a choice is one the question offers, an address is one. A question that asks the name or the email again takes the
 * person's own.
 * @param luma the answers as Luma takes them
 * @param kept the answers with their questions as asked, as the registration keeps them
 */
record RegistrationAnswers(List<LumaApi.Answer> luma, String kept) {

	private static final JsonMapper JSON = JsonMapper.builder().build();

	private static final Pattern PHONE = Pattern.compile("^\\+?[0-9 ().\\-]{6,30}$");

	private static final int MAX_LINE = 1000;

	private static final int MAX_TEXT = 10_000;

	private static final int MAX_URL = 2000;

	/**
	 * @throws ProgramException {@code REGISTRATION_FORM_CHANGED} when an answer names a question the event no longer
	 * asks; {@code REGISTRATION_ANSWERS_INVALID} when one is missing or not one its question takes
	 */
	static RegistrationAnswers check(LumaForm form, List<RegisterForEventRequest.Answer> sent, String name,
			String email) {
		Map<String, RegisterForEventRequest.Answer> byQuestion = new HashMap<>();
		for (RegisterForEventRequest.Answer answer : sent) {
			if (form.question(answer.questionId()).isEmpty()) {
				throw new ProgramException(ProgramErrorCode.REGISTRATION_FORM_CHANGED,
						"An answer names a question the event no longer asks");
			}
			if (byQuestion.put(answer.questionId(), answer) != null) {
				throw invalid("A question is answered twice");
			}
		}
		List<LumaApi.Answer> luma = new ArrayList<>();
		List<Map<String, Object>> kept = new ArrayList<>();
		for (LumaQuestion question : form.questions()) {
			Object value = question.known().<Object>map(known -> switch (known) {
				case NAME -> name;
				case EMAIL -> email;
			}).orElseGet(() -> value(question, byQuestion.get(question.id())));
			if (value == null) {
				if (question.required()) {
					throw invalid("A required question is not answered");
				}
				continue;
			}
			luma.add(new LumaApi.Answer(question.id(), value));
			Map<String, Object> answer = new LinkedHashMap<>();
			answer.put("questionId", question.id());
			answer.put("label", question.label());
			answer.put("type", question.type().value());
			answer.put("value", value);
			kept.add(answer);
		}
		return new RegistrationAnswers(List.copyOf(luma), JSON.writeValueAsString(kept));
	}

	/** The answer as Luma takes it; null when the person gave none. */
	private static @Nullable Object value(LumaQuestion question, RegisterForEventRequest.@Nullable Answer answer) {
		if (answer == null) {
			return null;
		}
		return switch (question.type()) {
			case TEXT -> line(answer.text(), question.multiline() ? MAX_TEXT : MAX_LINE);
			case SELECT -> question.multiple() ? choices(question, answer.choices()) : choice(question, answer.text());
			case AGREE_CHECK, TERMS -> Boolean.TRUE.equals(answer.agreed()) ? Boolean.TRUE : null;
			case COMPANY -> company(question, answer);
			case PHONE_NUMBER -> phone(answer.text());
			case URL -> url(answer.text());
			case GITHUB, INSTAGRAM, LINKEDIN, TELEGRAM, TWITTER, YOUTUBE -> line(answer.text(), 200);
		};
	}

	private static @Nullable String line(@Nullable String text, int max) {
		if (text == null || text.isBlank()) {
			return null;
		}
		String said = text.strip();
		if (said.length() > max) {
			throw invalid("An answer is too long");
		}
		return said;
	}

	private static @Nullable String choice(LumaQuestion question, @Nullable String text) {
		String chosen = line(text, MAX_LINE);
		if (chosen != null && !question.options().contains(chosen)) {
			throw invalid("A choice is not one the question offers");
		}
		return chosen;
	}

	private static @Nullable List<String> choices(LumaQuestion question, @Nullable List<String> sent) {
		if (sent == null || sent.isEmpty()) {
			return null;
		}
		Set<String> chosen = new LinkedHashSet<>(sent);
		if (!question.options().containsAll(chosen)) {
			throw invalid("A choice is not one the question offers");
		}
		// In the question's order, whatever order they were ticked in.
		return question.options().stream().filter(chosen::contains).toList();
	}

	private static @Nullable Map<String, String> company(LumaQuestion question,
			RegisterForEventRequest.Answer answer) {
		String company = line(answer.company(), 200);
		String title = question.jobTitle() ? line(answer.jobTitle(), 200) : null;
		if (company == null) {
			return null;
		}
		if (question.jobTitle() && question.required() && title == null) {
			throw invalid("The job title is not given");
		}
		Map<String, String> value = new LinkedHashMap<>();
		value.put("company", company);
		if (title != null) {
			value.put("job_title", title);
		}
		return value;
	}

	private static @Nullable String phone(@Nullable String text) {
		String phone = line(text, 30);
		if (phone != null && !PHONE.matcher(phone).matches()) {
			throw invalid("A phone number is not one");
		}
		return phone;
	}

	/** An address, with {@code https://} put in front when the person left it out. */
	private static @Nullable String url(@Nullable String text) {
		String said = line(text, MAX_URL);
		if (said == null) {
			return null;
		}
		String address = said.matches("(?i)^https?://.*") ? said : "https://" + said;
		try {
			URI uri = URI.create(address);
			if (uri.getHost() == null || !uri.getHost().contains(".")) {
				throw invalid("An address is not one");
			}
		}
		catch (IllegalArgumentException notAddress) {
			throw invalid("An address is not one");
		}
		return address;
	}

	private static ProgramException invalid(String diagnostic) {
		return new ProgramException(ProgramErrorCode.REGISTRATION_ANSWERS_INVALID, diagnostic);
	}

}
