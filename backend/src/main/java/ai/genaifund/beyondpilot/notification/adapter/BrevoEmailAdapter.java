package ai.genaifund.beyondpilot.notification.adapter;

import java.util.ArrayList;
import java.util.List;

import ai.genaifund.beyondpilot.notification.NotificationProperties;
import brevo.ApiClient;
import brevo.ApiException;
import brevo.auth.ApiKeyAuth;
import brevoApi.DomainsApi;
import brevoApi.TransactionalEmailsApi;
import brevoModel.CreateDomainModelDnsRecords;
import brevoModel.CreateDomainModelDnsRecordsDkimRecord;
import brevoModel.GetDomainConfigurationModel;
import brevoModel.SendSmtpEmail;
import brevoModel.SendSmtpEmailReplyTo;
import brevoModel.SendSmtpEmailSender;
import brevoModel.SendSmtpEmailTo;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * Delivers through Brevo's transactional API with its Java SDK. Brevo is given no idempotency key: the one it documents
 * answers a repeated request with an error and no message identifier, so a send retried after a lost answer would be
 * logged as refused although it left.
 */
@Component
class BrevoEmailAdapter implements EmailAdapter {

	private record Client(EmailConnection.BrevoConnection connection, ApiClient api) {
	}

	private final String apiUrl;

	private volatile @Nullable Client client;

	BrevoEmailAdapter(NotificationProperties properties) {
		this.apiUrl = properties.brevo().apiUrl();
	}

	@Override
	public EmailProvider provider() {
		return EmailProvider.BREVO;
	}

	@Override
	public EmailProviderCapabilities capabilities() {
		return new EmailProviderCapabilities(true);
	}

	@Override
	public EmailResult send(EmailRequest request, EmailConnection connection) {
		SendSmtpEmail email = new SendSmtpEmail()
			.sender(new SendSmtpEmailSender().name(request.fromName()).email(request.fromAddress()))
			.addToItem(new SendSmtpEmailTo().email(request.to()))
			.subject(request.subject())
			.htmlContent(request.html())
			.textContent(request.text());
		if (request.replyTo() != null) {
			email.replyTo(new SendSmtpEmailReplyTo().email(request.replyTo()));
		}
		try {
			String id = new TransactionalEmailsApi(api((EmailConnection.BrevoConnection) connection))
				.sendTransacEmail(email)
				.getMessageId();
			if (id == null || id.isBlank()) {
				throw new EmailDeliveryException(EmailDeliveryException.DeliveryFailure.UNAVAILABLE,
						"Brevo took an email without naming it");
			}
			return new EmailResult(messageId(id));
		}
		catch (ApiException exception) {
			int status = exception.getCode();
			EmailDeliveryException.DeliveryFailure failure;
			if (status == 0 || status >= 500) {
				failure = EmailDeliveryException.DeliveryFailure.UNAVAILABLE;
			}
			else if (status == 429) {
				failure = EmailDeliveryException.DeliveryFailure.THROTTLED;
			}
			else if (status == 401 || status == 403) {
				failure = EmailDeliveryException.DeliveryFailure.AUTHENTICATION;
			}
			else {
				failure = EmailDeliveryException.DeliveryFailure.REJECTED;
			}
			throw new EmailDeliveryException(failure, "Brevo answered " + status, exception);
		}
	}

	/**
	 * Brevo's identifier of a message without the angle brackets of a Message-ID header. The send answer is written with
	 * them and the examples of its delivery reports without, so both sides are stored and matched in this one form.
	 */
	private static String messageId(String id) {
		String stripped = id.strip();
		return stripped.startsWith("<") && stripped.endsWith(">") ? stripped.substring(1, stripped.length() - 1)
				: stripped;
	}

	/**
	 * Reads the sender's domain at Brevo: whether it is added, verified and authenticated, and the three DNS records
	 * Brevo asks for, each with whether Brevo found it. Brevo says only found or not, so a record it has not found is
	 * pending.
	 */
	@Override
	public EmailSetup inspect(EmailConnection connection, String domain) {
		List<EmailSetup.Check> checks = new ArrayList<>();
		List<EmailSetup.DnsRecord> records = new ArrayList<>();
		try {
			GetDomainConfigurationModel read = new DomainsApi(api((EmailConnection.BrevoConnection) connection))
				.getDomainConfiguration(domain);
			checks.add(new EmailSetup.Check(EmailSetup.Step.CREDENTIALS, EmailSetup.State.OK));
			checks.add(new EmailSetup.Check(EmailSetup.Step.DOMAIN_ADDED, EmailSetup.State.OK));
			checks.add(new EmailSetup.Check(EmailSetup.Step.DOMAIN_VERIFIED, state(read.isVerified())));
			checks.add(new EmailSetup.Check(EmailSetup.Step.DKIM, state(read.isAuthenticated())));
			CreateDomainModelDnsRecords dns = read.getDnsRecords();
			if (dns != null) {
				add(records, "brevo_code", dns.getBrevoCode(), domain);
				add(records, "dkim", dns.getDkimRecord(), domain);
				add(records, "dmarc", dns.getDmarcRecord(), domain);
			}
			return new EmailSetup(checks, records, null);
		}
		catch (ApiException refused) {
			int status = refused.getCode();
			if (status == 404 || status == 400) {
				// The key was taken and the domain is the only thing asked about, so Brevo does not know the domain.
				checks.add(new EmailSetup.Check(EmailSetup.Step.CREDENTIALS, EmailSetup.State.OK));
				checks.add(new EmailSetup.Check(EmailSetup.Step.DOMAIN_ADDED, EmailSetup.State.FAILED));
				return new EmailSetup(checks, records, null);
			}
			EmailSetup.Limit limit = status == 401 ? EmailSetup.Limit.CREDENTIALS_REFUSED
					: status == 403 ? EmailSetup.Limit.PERMISSION_MISSING : EmailSetup.Limit.UNREACHABLE;
			return new EmailSetup(checks, records, limit);
		}
	}

	private static void add(List<EmailSetup.DnsRecord> records, String purpose,
			@Nullable CreateDomainModelDnsRecordsDkimRecord record, String domain) {
		if (record == null || record.getHostName() == null || record.getValue() == null) {
			return;
		}
		records.add(new EmailSetup.DnsRecord(purpose, record.getType() == null ? "TXT" : record.getType(),
				EmailSetup.DnsRecord.hostOf(record.getHostName(), domain), record.getValue(), null,
				state(record.isStatus())));
	}

	private static EmailSetup.State state(@Nullable Boolean found) {
		return found == null ? EmailSetup.State.UNKNOWN : found ? EmailSetup.State.OK : EmailSetup.State.PENDING;
	}

	private ApiClient api(EmailConnection.BrevoConnection connection) {
		Client current = client;
		if (current != null && current.connection().equals(connection)) {
			return current.api();
		}
		ApiClient api = new ApiClient().setBasePath(apiUrl).setConnectTimeout(10_000).setReadTimeout(20_000);
		((ApiKeyAuth) api.getAuthentication("api-key")).setApiKey(connection.apiKey());
		client = new Client(connection, api);
		return api;
	}

}
