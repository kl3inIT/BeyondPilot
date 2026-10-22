package ai.genaifund.beyondpilot.identity;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.identity.dto.ConsentRequest;
import ai.genaifund.beyondpilot.identity.dto.ConsentResponse;
import ai.genaifund.beyondpilot.identity.persistence.ConsentRecordRepository;
import ai.genaifund.beyondpilot.identity.persistence.ConsentRecordRepository.Choice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What each person agreed to about their personal data (BEY-240). The text is versioned in the repository; every choice
 * is a new row of the append-only record, which is the proof the law asks the controller to keep.
 */
@Service
public class Consents {

	/** The version of the consent text shown now; its words are {@code consent/v<version>.<locale>.md}. */
	static final int VERSION = 1;

	private static final String LOCALE = "en";

	private static final Logger LOG = LoggerFactory.getLogger(Consents.class);

	private final ConsentRecordRepository records;

	private final ConsentChoices choices;

	private final IdentityService identity;

	private final ApplicationEventPublisher events;

	private final String text;

	Consents(ConsentRecordRepository records, ConsentChoices choices, IdentityService identity,
			ApplicationEventPublisher events) {
		this.records = records;
		this.choices = choices;
		this.identity = identity;
		this.events = events;
		this.text = read("consent/v" + VERSION + "." + LOCALE + ".md");
	}

	/**
	 * The current text and the caller's choices under it.
	 * @throws IdentityException when the account is disabled
	 */
	@Transactional(readOnly = true)
	public ConsentResponse current(Actor actor) {
		identity.requireActive(actor);
		return response(choices.of(actor.accountId()));
	}

	/**
	 * Records the caller's choices. A purpose is written when its choice changes, when the caller never answered it, or
	 * when the current version asks it again, so the first answer records every purpose, a refusal included.
	 * @throws IdentityException when the account is disabled
	 */
	@Transactional
	public ConsentResponse record(Actor actor, ConsentRequest request) {
		identity.requireActive(actor);
		Map<ConsentPurpose, Choice> before = choices.of(actor.accountId());
		String requestId = MDC.get("request_id");
		for (ConsentPurpose purpose : ConsentPurpose.values()) {
			boolean granted = chosen(request, purpose);
			Choice current = before.get(purpose);
			if (current == null || current.granted() != granted) {
				records.insert(actor.accountId(), purpose.key(), granted, VERSION, LOCALE, request.source(), requestId);
				events.publishEvent(new ConsentChanged(actor.accountId(), purpose, granted,
						current != null && current.granted() && !granted));
				LOG.atInfo()
					.addKeyValue("event", "identity.consent.recorded")
					.addKeyValue("account_id", actor.accountId())
					.addKeyValue("purpose", purpose.key())
					.addKeyValue("granted", granted)
					.addKeyValue("version", VERSION)
					.log("Consent recorded");
			}
		}
		return response(choices.of(actor.accountId()));
	}

	private ConsentResponse response(Map<ConsentPurpose, Choice> current) {
		return new ConsentResponse(VERSION, LOCALE, text, ConsentChoices.needed(current),
				Arrays.stream(ConsentPurpose.values()).map(purpose -> {
					Choice choice = current.get(purpose);
					return new ConsentResponse.Purpose(purpose.key(), requiredFor(purpose),
							choice == null ? null : choice.granted(), choice == null ? null : choice.recordedAt());
				}).toList());
	}

	private static String requiredFor(ConsentPurpose purpose) {
		return switch (purpose) {
			case PLATFORM -> "platform";
			case PARTNERS -> "apply";
			case AI, UPDATES -> "none";
		};
	}

	private static boolean chosen(ConsentRequest request, ConsentPurpose purpose) {
		return switch (purpose) {
			case PLATFORM -> request.platform();
			case PARTNERS -> request.partners();
			case AI -> request.ai();
			case UPDATES -> request.updates();
		};
	}

	private static String read(String path) {
		try (InputStream in = new ClassPathResource(path).getInputStream()) {
			return new String(in.readAllBytes(), StandardCharsets.UTF_8);
		}
		catch (IOException ex) {
			throw new UncheckedIOException("The consent text " + path + " is missing", ex);
		}
	}
}
