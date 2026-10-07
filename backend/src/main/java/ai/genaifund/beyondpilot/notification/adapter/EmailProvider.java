package ai.genaifund.beyondpilot.notification.adapter;

import java.util.Arrays;
import java.util.Optional;

/** Who delivers BeyondPilot's email. The value is stored in the settings and with every message sent. */
public enum EmailProvider {

	SES("ses"),

	RESEND("resend"),

	SMTP("smtp");

	private final String value;

	EmailProvider(String value) {
		this.value = value;
	}

	public String value() {
		return value;
	}

	public static Optional<EmailProvider> of(String value) {
		return Arrays.stream(values()).filter(provider -> provider.value.equals(value)).findFirst();
	}

}
