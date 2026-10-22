package ai.genaifund.beyondpilot.identity;

import java.util.Locale;

/**
 * What a person agrees to BeyondPilot doing with their personal data, one consent for each (Law 91/2025/QH15 art.
 * 9(4)). The keys are stored and never change meaning.
 */
public enum ConsentPurpose {

	/** Processing to use the platform and take part in its programs; without it the account is refused. */
	PLATFORM(1),

	/** Sharing with a program's partner enterprises, judges and mentors; needed to submit an application or proposal. */
	PARTNERS(1),

	/** AI that suggests the person's profile and helps evaluate their applications; optional. */
	AI(1),

	/** Updates, newsletters and event invitations; optional. */
	UPDATES(1);

	private final int askedSince;

	ConsentPurpose(int askedSince) {
		this.askedSince = askedSince;
	}

	/** The stored and published name. */
	public String key() {
		return name().toLowerCase(Locale.ROOT);
	}

	/**
	 * The version of the consent text that last asked this purpose again. A choice made under an earlier version no
	 * longer counts; a new text that does not change what a purpose means leaves it as it is.
	 */
	int askedSince() {
		return askedSince;
	}

	/**
	 * The purpose a stored name stands for.
	 * @throws IllegalArgumentException when no purpose has that name
	 */
	public static ConsentPurpose of(String key) {
		return valueOf(key.toUpperCase(Locale.ROOT));
	}
}
