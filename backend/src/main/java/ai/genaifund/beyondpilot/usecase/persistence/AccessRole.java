package ai.genaifund.beyondpilot.usecase.persistence;

import java.util.Locale;
import java.util.Optional;

/**
 * What a person may do with one use case, from nothing to everything. Each role may do what the ones before it may:
 * a viewer reads it, an editor changes it, and a person with full access also shares it, sends it for review and
 * makes it private or public.
 */
public enum AccessRole {

	NONE, VIEWER, EDITOR, FULL_ACCESS;

	/** The role as the database and the API write it: lowercase, with an underscore. */
	public String code() {
		return name().toLowerCase(Locale.ROOT);
	}

	/** Whether this role may do whatever {@code needed} allows. */
	public boolean atLeast(AccessRole needed) {
		return compareTo(needed) >= 0;
	}

	/** The larger of two roles. */
	public AccessRole or(AccessRole other) {
		return atLeast(other) ? this : other;
	}

	/** The role a code names, if it names one. */
	public static Optional<AccessRole> of(String code) {
		for (AccessRole role : values()) {
			if (role.code().equals(code)) {
				return Optional.of(role);
			}
		}
		return Optional.empty();
	}

}
