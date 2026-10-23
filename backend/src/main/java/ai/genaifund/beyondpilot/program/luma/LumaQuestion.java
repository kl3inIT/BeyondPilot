package ai.genaifund.beyondpilot.program.luma;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

import org.jspecify.annotations.Nullable;
import tools.jackson.databind.JsonNode;

/**
 * One question of an event's registration form on Luma (BEY-245), as the host wrote it there.
 * @param multiline for text, whether the answer may run over several lines
 * @param options for a select, what may be chosen, in Luma's order
 * @param multiple for a select, whether several options may be chosen
 * @param jobTitle for company, whether the job title is asked beside it
 * @param termsUrl for terms, the address of the terms to read; null when they are written out
 * @param termsText for terms, the terms in Markdown; null when they are a link
 */
public record LumaQuestion(String id, String label, Type type, boolean required, boolean multiline,
		List<String> options, boolean multiple, boolean jobTitle, @Nullable String termsUrl,
		@Nullable String termsText) {

	/** The kinds of question Luma offers, by the value its API names them with. */
	public enum Type {

		TEXT("text"), SELECT("select"), AGREE_CHECK("agree-check"), TERMS("terms"), COMPANY("company"),
		PHONE_NUMBER("phone-number"), URL("url"), GITHUB("github"), INSTAGRAM("instagram"), LINKEDIN("linkedin"),
		TELEGRAM("telegram"), TWITTER("twitter"), YOUTUBE("youtube");

		private final String value;

		Type(String value) {
			this.value = value;
		}

		public String value() {
			return value;
		}

		static Optional<Type> of(@Nullable String value) {
			for (Type type : values()) {
				if (type.value.equals(value)) {
					return Optional.of(type);
				}
			}
			return Optional.empty();
		}

		/** A handle or an address on a social network, answered as one line of text. */
		public boolean handle() {
			return Set.of(GITHUB, INSTAGRAM, LINKEDIN, TELEGRAM, TWITTER, YOUTUBE).contains(this);
		}

	}

	/** What the person's own account answers, so the form does not ask it twice. */
	public enum Known {
		NAME, EMAIL
	}

	/**
	 * Whether the question asks again what Luma's own fields hold: a text question labelled Name or Email, as the
	 * Tasco and Nestlé briefings ask beside them.
	 */
	public Optional<Known> known() {
		if (type != Type.TEXT || multiline) {
			return Optional.empty();
		}
		String said = label.strip().toLowerCase(Locale.ROOT).replaceAll("[^a-z ]", "").strip();
		return switch (said) {
			case "name", "full name", "your name" -> Optional.of(Known.NAME);
			case "email", "email address", "your email", "e mail" -> Optional.of(Known.EMAIL);
			default -> Optional.empty();
		};
	}

	/** The question of the node; empty when it lacks an identifier or a label. */
	static Optional<LumaQuestion> of(JsonNode node, Type type) {
		String id = LumaApi.text(node, "id");
		String label = LumaApi.text(node, "label");
		if (id == null || label == null) {
			return Optional.empty();
		}
		List<String> options = new ArrayList<>();
		for (JsonNode option : node.path("options")) {
			if (option.isString() && !option.asString().isBlank()) {
				options.add(option.asString());
			}
		}
		JsonNode terms = node.path("terms");
		boolean link = "link".equals(LumaApi.text(terms, "content_type"));
		return Optional.of(new LumaQuestion(id, label, type, node.path("required").asBoolean(false),
				node.path("multiline").asBoolean(false), List.copyOf(options), node.path("multiple").asBoolean(false),
				node.path("collect_job_title").asBoolean(false), link ? LumaApi.text(terms, "url") : null,
				link ? null : LumaApi.text(terms, "content_md")));
	}

}
