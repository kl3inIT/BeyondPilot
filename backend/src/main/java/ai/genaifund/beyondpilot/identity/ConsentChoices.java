package ai.genaifund.beyondpilot.identity;

import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import ai.genaifund.beyondpilot.identity.persistence.ConsentRecordRepository;
import ai.genaifund.beyondpilot.identity.persistence.ConsentRecordRepository.Choice;
import org.springframework.stereotype.Component;

/** A person's choices that still count, read by the account (whether it may go on) and by the consent paths. */
@Component
class ConsentChoices {

	private final ConsentRecordRepository records;

	ConsentChoices(ConsentRecordRepository records) {
		this.records = records;
	}

	/** The latest choice for each purpose, leaving out one made under a version older than the one that asked it last. */
	Map<ConsentPurpose, Choice> of(UUID accountId) {
		return records.latest(accountId)
			.stream()
			.filter(choice -> choice.version() >= ConsentPurpose.of(choice.purpose()).askedSince())
			.collect(Collectors.toMap(choice -> ConsentPurpose.of(choice.purpose()), Function.identity()));
	}

	/** Whether the account must agree to the platform purpose before anything else. */
	boolean needed(UUID accountId) {
		return needed(of(accountId));
	}

	static boolean needed(Map<ConsentPurpose, Choice> choices) {
		Choice platform = choices.get(ConsentPurpose.PLATFORM);
		return platform == null || !platform.granted();
	}
}
