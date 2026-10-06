package ai.genaifund.beyondpilot.notification.adapter;

import java.time.Duration;

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
import software.amazon.awssdk.services.sesv2.model.MessageRejectedException;
import software.amazon.awssdk.services.sesv2.model.MessageTag;
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
