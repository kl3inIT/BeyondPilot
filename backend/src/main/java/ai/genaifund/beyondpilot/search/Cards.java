package ai.genaifund.beyondpilot.search;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.jspecify.annotations.Nullable;

/** How an item becomes the text and the facets of its row, with the same rules for every kind. */
final class Cards {

	static final String TYPE = "type";

	static final String COVER = "coverFileId";

	static final String EXTERNAL_URL = "externalUrl";

	static final String OPENS_AT = "applicationsOpenAt";

	static final String CLOSES_AT = "applicationsCloseAt";

	static final String ORGANIZATION_SLUG = "organizationSlug";

	static final String COUNTRY = "country";

	static final String MATURITY = "maturity";

	static final String INDUSTRIES = "industries";

	static final String FOCUS_AREAS = "focusAreas";

	static final String ROLES = "roles";

	static final String SKILLS = "skills";

	static final String AVAILABILITY = "availability";

	private Cards() {
	}

	/** Adds a facet that has a value; an instant or an identifier is kept as its text, an empty list not at all. */
	static void put(Map<String, Object> facets, String name, @Nullable Object value) {
		if (value == null || (value instanceof Collection<?> values && values.isEmpty())) {
			return;
		}
		facets.put(name, value instanceof Instant || value instanceof UUID ? value.toString() : value);
	}

	/** The card: each piece a person reads on the page, one per line. */
	static String lines(@Nullable String... pieces) {
		return Stream.of(pieces)
			.filter(Objects::nonNull)
			.filter(piece -> !piece.isBlank())
			.collect(Collectors.joining("\n"));
	}

	/** Codes as words, so "customer_service" is found by "customer service". */
	@SafeVarargs
	static String words(List<String>... codes) {
		return Stream.of(codes)
			.flatMap(List::stream)
			.map(code -> code.replace('_', ' '))
			.distinct()
			.collect(Collectors.joining(" "));
	}

}
