package ai.genaifund.beyondpilot.notification.adapter;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * How to reach one provider, with its secrets in clear: built from the settings for one send and never stored or
 * logged. Each record's {@code toString} leaves the secrets out.
 */
public sealed interface EmailConnection {

	EmailProvider provider();

	/**
	 * Amazon SES in one region of one AWS account.
	 * @param configurationSet the SES configuration set whose events report delivery; null to send without one
	 */
	record SesConnection(String region, String accessKeyId, String secretAccessKey,
			@Nullable String configurationSet) implements EmailConnection {

		public SesConnection {
			Objects.requireNonNull(region, "region must not be null");
			Objects.requireNonNull(accessKeyId, "accessKeyId must not be null");
			Objects.requireNonNull(secretAccessKey, "secretAccessKey must not be null");
		}

		@Override
		public EmailProvider provider() {
			return EmailProvider.SES;
		}

		@Override
		public String toString() {
			return "SesConnection[region=" + region + ", accessKeyId=" + accessKeyId + ", configurationSet="
					+ configurationSet + "]";
		}

	}

	/** Resend, reached with an API key. */
	record ResendConnection(String apiKey) implements EmailConnection {

		public ResendConnection {
			Objects.requireNonNull(apiKey, "apiKey must not be null");
		}

		@Override
		public EmailProvider provider() {
			return EmailProvider.RESEND;
		}

		@Override
		public String toString() {
			return "ResendConnection[]";
		}

	}

	/**
	 * Any SMTP server.
	 * @param username null when the server takes mail without signing in
	 * @param password null when there is no username
	 */
	record SmtpConnection(String host, int port, @Nullable String username, @Nullable String password,
			SmtpSecurity security) implements EmailConnection {

		public SmtpConnection {
			Objects.requireNonNull(host, "host must not be null");
			Objects.requireNonNull(security, "security must not be null");
			if (port < 1 || port > 65535) {
				throw new IllegalArgumentException("port must be between 1 and 65535");
			}
		}

		@Override
		public EmailProvider provider() {
			return EmailProvider.SMTP;
		}

		@Override
		public String toString() {
			return "SmtpConnection[host=" + host + ", port=" + port + ", username=" + username + ", security="
					+ security + "]";
		}

	}

	/** How the connection to an SMTP server is protected. */
	enum SmtpSecurity {

		/** Plain connection upgraded with STARTTLS, which must succeed; usually port 587. */
		STARTTLS("starttls"),

		/** TLS from the first byte; usually port 465. */
		TLS("tls"),

		/** No protection: only for a relay on a trusted network. */
		NONE("none");

		private final String value;

		SmtpSecurity(String value) {
			this.value = value;
		}

		public String value() {
			return value;
		}

		public static SmtpSecurity of(String value) {
			for (SmtpSecurity security : values()) {
				if (security.value.equals(value)) {
					return security;
				}
			}
			throw new IllegalArgumentException("Unknown SMTP security " + value);
		}

	}

}
