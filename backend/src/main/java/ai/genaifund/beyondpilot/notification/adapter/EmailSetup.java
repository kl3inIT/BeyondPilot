package ai.genaifund.beyondpilot.notification.adapter;

import java.util.List;
import java.util.Locale;

import org.jspecify.annotations.Nullable;

/**
 * What a provider says about whether email from one domain can leave: each step of the setup and the DNS records it
 * asks for. Read from the provider's own API each time; nothing here is stored.
 */
public record EmailSetup(List<Check> checks, List<DnsRecord> records, @Nullable Limit limit) {

	public EmailSetup {
		checks = List.copyOf(checks);
		records = List.copyOf(records);
	}

	/** For a provider with no API to ask, such as an SMTP server: the test email is the check. */
	public static EmailSetup nothingToAsk() {
		return new EmailSetup(List.of(), List.of(), null);
	}

	/** Why the provider could not be asked everything; the checks it did answer are still there. */
	public enum Limit {

		/** The key or the user may send but not read the account or the domain, as Resend's sending-only keys. */
		PERMISSION_MISSING("permission_missing"),

		/** The provider refused the credentials. */
		CREDENTIALS_REFUSED("credentials_refused"),

		/** The provider did not answer. */
		UNREACHABLE("unreachable");

		private final String value;

		Limit(String value) {
			this.value = value;
		}

		public String value() {
			return value;
		}

	}

	/** Where one step stands. */
	public enum State {

		OK("ok"), PENDING("pending"), FAILED("failed"), UNKNOWN("unknown");

		private final String value;

		State(String value) {
			this.value = value;
		}

		public String value() {
			return value;
		}

	}

	/** One step of the setup. */
	public enum Step {

		/** The provider took the key or the login. */
		CREDENTIALS("credentials"),

		/** The sender's domain is added to the provider. */
		DOMAIN_ADDED("domain_added"),

		/** The provider proved the domain is ours and sends from it. */
		DOMAIN_VERIFIED("domain_verified"),

		/** Mail from the domain is signed with the provider's DKIM keys. */
		DKIM("dkim"),

		/** Bounces return to a subdomain of ours, so SPF aligns. */
		MAIL_FROM("mail_from"),

		/** Amazon SES sends to anyone, not only to verified addresses as in its sandbox. */
		PRODUCTION_ACCESS("production_access"),

		/** The account may send at all; the provider pauses an account whose bounces or complaints run high. */
		SENDING_ENABLED("sending_enabled");

		private final String value;

		Step(String value) {
			this.value = value;
		}

		public String value() {
			return value;
		}

	}

	public record Check(Step step, State state) {
	}

	/**
	 * A record the domain's DNS must hold.
	 * @param purpose {@code dkim}, {@code spf}, {@code mail_from}, {@code dmarc} or the provider's own word
	 * @param host the name relative to the domain, as DNS hosts ask for it: {@code resend._domainkey}, {@code @} for the
	 * domain itself
	 * @param priority the MX priority; null for any other type
	 * @param state whether the provider found it; {@link State#UNKNOWN} for a record no provider looks for
	 */
	public record DnsRecord(String purpose, String type, String host, String value, @Nullable Integer priority,
			State state) {

		/** The host of a full name within the domain: {@code mail.example.com} in {@code example.com} is {@code mail}. */
		public static String hostOf(String name, String domain) {
			String lower = name.toLowerCase(Locale.ROOT);
			if (lower.equals(domain)) {
				return "@";
			}
			return lower.endsWith("." + domain) ? name.substring(0, name.length() - domain.length() - 1) : name;
		}

	}

}
