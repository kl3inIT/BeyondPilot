package ai.genaifund.beyondpilot.notification.template;

/** Where an operator finds a kind of email: the part of BeyondPilot that sends it. */
public enum EmailGroup {

	SIGN_IN("sign_in"),

	ORGANIZATIONS("organizations"),

	APPLICATIONS("applications"),

	INTRODUCTIONS("introductions"),

	TALENT("talent");

	private final String value;

	EmailGroup(String value) {
		this.value = value;
	}

	public String value() {
		return value;
	}

}
