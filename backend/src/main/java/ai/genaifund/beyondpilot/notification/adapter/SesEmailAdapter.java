package ai.genaifund.beyondpilot.notification.adapter;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import jakarta.annotation.PreDestroy;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.AccountSuspendedException;
import software.amazon.awssdk.services.sesv2.model.DkimAttributes;
import software.amazon.awssdk.services.sesv2.model.GetAccountResponse;
import software.amazon.awssdk.services.sesv2.model.GetEmailIdentityResponse;
import software.amazon.awssdk.services.sesv2.model.MailFromAttributes;
import software.amazon.awssdk.services.sesv2.model.MessageRejectedException;
import software.amazon.awssdk.services.sesv2.model.MessageTag;
import software.amazon.awssdk.services.sesv2.model.NotFoundException;
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest;
import software.amazon.awssdk.services.sesv2.model.SendingPausedException;
import software.amazon.awssdk.services.sesv2.model.SesV2Exception;
import software.amazon.awssdk.services.sesv2.model.TooManyRequestsException;

/**
 * Delivers through Amazon SES with the SDK's v2 API, in the account and region of the settings. The configuration
 * set, when there is one, publishes the delivery events of what is sent.
 */
@Component
class SesEmailAdapter implements EmailAdapter {

	private record Client(EmailConnection.SesConnection connection, SesV2Client ses) {
	}

	private volatile @Nullable Client client;

	@Override
	public EmailProvider provider() {
		return EmailProvider.SES;
	}

	@Override
	public EmailProviderCapabilities capabilities() {
		return new EmailProviderCapabilities(true);
	}

	@Override
	public EmailResult send(EmailRequest request, EmailConnection connection) {
		EmailConnection.SesConnection ses = (EmailConnection.SesConnection) connection;
		SendEmailRequest.Builder send = SendEmailRequest.builder()
			.fromEmailAddress(from(request))
			.destination(destination -> destination.toAddresses(request.to()))
			.content(content -> content.simple(message -> message
				.subject(subject -> subject.data(request.subject()).charset("UTF-8"))
				.body(body -> body.html(html -> html.data(request.html()).charset("UTF-8"))
					.text(text -> text.data(request.text()).charset("UTF-8")))))
			.emailTags(MessageTag.builder().name("kind").value(request.kind()).build());
		if (request.replyTo() != null) {
			send.replyToAddresses(request.replyTo());
		}
		if (ses.configurationSet() != null) {
			send.configurationSetName(ses.configurationSet());
		}
		try {
			return new EmailResult(client(ses).sendEmail(send.build()).messageId());
		}
		catch (TooManyRequestsException exception) {
			throw new EmailDeliveryException(EmailDeliveryException.DeliveryFailure.THROTTLED, "SES asked to slow down",
					exception);
		}
		catch (MessageRejectedException exception) {
			throw new EmailDeliveryException(EmailDeliveryException.DeliveryFailure.REJECTED,
					"SES rejected the message", exception);
		}
		catch (AccountSuspendedException | SendingPausedException exception) {
			throw new EmailDeliveryException(EmailDeliveryException.DeliveryFailure.UNAVAILABLE,
					"SES is not sending for this account", exception);
		}
		catch (SesV2Exception exception) {
			int status = exception.statusCode();
			EmailDeliveryException.DeliveryFailure failure = status == 401 || status == 403
					? EmailDeliveryException.DeliveryFailure.AUTHENTICATION
					: status >= 500 ? EmailDeliveryException.DeliveryFailure.UNAVAILABLE
							: EmailDeliveryException.DeliveryFailure.REJECTED;
			throw new EmailDeliveryException(failure, "SES answered " + status, exception);
		}
		catch (SdkClientException exception) {
			throw new EmailDeliveryException(EmailDeliveryException.DeliveryFailure.UNAVAILABLE,
					"SES could not be reached", exception);
		}
	}

	/**
	 * Reads the account (sandbox, paused) and the domain's identity (verified, DKIM, MAIL FROM) in the region of the
	 * settings. A user allowed only ses:SendEmail reads nothing, which says so instead of failing the checks.
	 */
	@Override
	public EmailSetup inspect(EmailConnection connection, String domain) {
		EmailConnection.SesConnection ses = (EmailConnection.SesConnection) connection;
		SesV2Client client = client(ses);
		List<EmailSetup.Check> checks = new ArrayList<>();
		List<EmailSetup.DnsRecord> records = new ArrayList<>();
		GetAccountResponse account;
		try {
			account = client.getAccount(request -> {
			});
		}
		catch (SesV2Exception refused) {
			return new EmailSetup(checks, records, limitOf(refused));
		}
		catch (SdkClientException unreachable) {
			return new EmailSetup(checks, records, EmailSetup.Limit.UNREACHABLE);
		}
		checks.add(new EmailSetup.Check(EmailSetup.Step.CREDENTIALS, EmailSetup.State.OK));
		checks.add(new EmailSetup.Check(EmailSetup.Step.SENDING_ENABLED,
				Boolean.TRUE.equals(account.sendingEnabled()) ? EmailSetup.State.OK : EmailSetup.State.FAILED));
		checks.add(new EmailSetup.Check(EmailSetup.Step.PRODUCTION_ACCESS,
				Boolean.TRUE.equals(account.productionAccessEnabled()) ? EmailSetup.State.OK
						: EmailSetup.State.PENDING));
		GetEmailIdentityResponse identity;
		try {
			identity = client.getEmailIdentity(request -> request.emailIdentity(domain));
		}
		catch (NotFoundException missing) {
			checks.add(new EmailSetup.Check(EmailSetup.Step.DOMAIN_ADDED, EmailSetup.State.FAILED));
			return new EmailSetup(checks, records, null);
		}
		catch (SesV2Exception refused) {
			return new EmailSetup(checks, records, limitOf(refused));
		}
		catch (SdkClientException unreachable) {
			return new EmailSetup(checks, records, EmailSetup.Limit.UNREACHABLE);
		}
		checks.add(new EmailSetup.Check(EmailSetup.Step.DOMAIN_ADDED, EmailSetup.State.OK));
		checks.add(new EmailSetup.Check(EmailSetup.Step.DOMAIN_VERIFIED,
				Boolean.TRUE.equals(identity.verifiedForSendingStatus()) ? EmailSetup.State.OK
						: state(identity.verificationStatusAsString())));
		DkimAttributes dkim = identity.dkimAttributes();
		if (dkim != null) {
			EmailSetup.State signed = state(dkim.statusAsString());
			checks.add(new EmailSetup.Check(EmailSetup.Step.DKIM, signed));
			// Easy DKIM: three CNAMEs, each pointing a token's selector at Amazon's key.
			for (String token : dkim.tokens()) {
				records.add(new EmailSetup.DnsRecord("dkim", "CNAME", token + "._domainkey",
						token + ".dkim.amazonses.com", null, signed));
			}
		}
		MailFromAttributes mailFrom = identity.mailFromAttributes();
		if (mailFrom != null && mailFrom.mailFromDomain() != null && !mailFrom.mailFromDomain().isBlank()) {
			EmailSetup.State returned = state(mailFrom.mailFromDomainStatusAsString());
			String host = EmailSetup.DnsRecord.hostOf(mailFrom.mailFromDomain(), domain);
			checks.add(new EmailSetup.Check(EmailSetup.Step.MAIL_FROM, returned));
			records.add(new EmailSetup.DnsRecord("mail_from", "MX", host,
					"feedback-smtp." + ses.region() + ".amazonses.com", 10, returned));
			records.add(new EmailSetup.DnsRecord("spf", "TXT", host, "v=spf1 include:amazonses.com ~all", null,
					returned));
		}
		return new EmailSetup(checks, records, null);
	}

	/** SES's words for where a verification stands. */
	private static EmailSetup.State state(@Nullable String status) {
		return switch (status == null ? "" : status) {
			case "SUCCESS" -> EmailSetup.State.OK;
			case "PENDING", "NOT_STARTED" -> EmailSetup.State.PENDING;
			case "FAILED", "TEMPORARY_FAILURE" -> EmailSetup.State.FAILED;
			default -> EmailSetup.State.UNKNOWN;
		};
	}

	/** A refusal from SES: a missing permission reads differently from credentials it does not know. */
	private static EmailSetup.Limit limitOf(SesV2Exception refused) {
		String code = refused.awsErrorDetails() == null ? "" : String.valueOf(refused.awsErrorDetails().errorCode());
		return switch (code) {
			case "AccessDeniedException", "AccessDenied" -> EmailSetup.Limit.PERMISSION_MISSING;
			case "UnrecognizedClientException", "InvalidClientTokenId", "SignatureDoesNotMatch",
					"InvalidSignatureException" -> EmailSetup.Limit.CREDENTIALS_REFUSED;
			default -> refused.statusCode() >= 500 ? EmailSetup.Limit.UNREACHABLE
					: EmailSetup.Limit.CREDENTIALS_REFUSED;
		};
	}

	private static String from(EmailRequest request) {
		String name = request.fromName().replace("\"", "");
		return "\"" + name + "\" <" + request.fromAddress() + ">";
	}

	private SesV2Client client(EmailConnection.SesConnection connection) {
		Client current = client;
		if (current != null && current.connection().equals(connection)) {
			return current.ses();
		}
		SesV2Client ses = SesV2Client.builder()
			.region(Region.of(connection.region()))
			.credentialsProvider(StaticCredentialsProvider
				.create(AwsBasicCredentials.create(connection.accessKeyId(), connection.secretAccessKey())))
			.httpClientBuilder(UrlConnectionHttpClient.builder()
				.connectionTimeout(Duration.ofSeconds(10))
				.socketTimeout(Duration.ofSeconds(20)))
			.build();
		client = new Client(connection, ses);
		if (current != null) {
			current.ses().close();
		}
		return ses;
	}

	@PreDestroy
	void close() {
		Client current = client;
		if (current != null) {
			current.ses().close();
		}
	}

}
