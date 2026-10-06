package ai.genaifund.beyondpilot.notification.adapter;

/** Delivers email through one provider. */
public interface EmailAdapter {

	EmailProvider provider();

	EmailProviderCapabilities capabilities();

	/**
	 * Hands one email to the provider.
	 * @param connection the provider's connection; always of this adapter's provider
	 * @throws EmailDeliveryException when the provider did not take it
	 */
	EmailResult send(EmailRequest request, EmailConnection connection);

	/**
	 * Asks the provider whether email from a domain can leave: its account, the domain and the DNS records it wants.
	 * A provider with no API to ask answers {@link EmailSetup#nothingToAsk()}.
	 * @param connection the provider's connection; always of this adapter's provider
	 * @param domain the sender's domain, in lower case
	 */
	EmailSetup inspect(EmailConnection connection, String domain);

}
