package ai.genaifund.beyondpilot.ai.adapter;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Outbound HTTP to an endpoint an operator configured, for what an adapter asks outside its vendor's SDK: listing
 * models, reading a picture. It follows MemoryOS's {@code OutboundHttp} (its ADR 0025), kept to what is used here. A
 * call made through it
 * <ul>
 * <li>never follows a redirect, so a key cannot be sent on to another host;</li>
 * <li>ends at its deadline, counted from sending the request to the last byte read;</li>
 * <li>stops reading an answer at its bound;</li>
 * <li>hands back the status with the bytes whatever the status is, so no provider's text reaches an exception or a
 * log. What a status means is the adapter's to say.</li>
 * </ul>
 */
final class OutboundHttp {

	private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);

	/** Over TLS the version is agreed in the handshake, so HTTP/2 is used wherever the server offers it. */
	private static final HttpClient SECURE = HttpClient.newBuilder()
		.version(HttpClient.Version.HTTP_2)
		.followRedirects(HttpClient.Redirect.NEVER)
		.connectTimeout(CONNECT_TIMEOUT)
		.build();

	/**
	 * Plain HTTP stays on HTTP/1.1: asked for HTTP/2 there, the JDK client sends an upgrade request with every new
	 * connection, which self-hosted gateways do not speak and some mishandle.
	 */
	private static final HttpClient PLAIN = HttpClient.newBuilder()
		.version(HttpClient.Version.HTTP_1_1)
		.followRedirects(HttpClient.Redirect.NEVER)
		.connectTimeout(CONNECT_TIMEOUT)
		.build();

	private OutboundHttp() {
	}

	/** The deadline for one exchange and the largest answer read. */
	record Limits(Duration timeout, int maxResponseBytes) {
	}

	/**
	 * What a provider answered.
	 * @param body at most one byte more than the bound, so an answer that is too long can be told from one that fits
	 */
	record Answer(int status, byte[] body) {
	}

	/**
	 * @param headers what carries the key; the address never does
	 * @throws IOException when no answer came in time: a refused connection, DNS, the deadline, or an address the
	 * client cannot use
	 */
	static Answer get(String address, Map<String, String> headers, Limits limits) throws IOException {
		return exchange(HttpMethod.GET, address, headers, null, limits);
	}

	/**
	 * @param headers what carries the key; the address never does
	 * @throws IOException when no answer came in time: a refused connection, DNS, the deadline, or an address the
	 * client cannot use
	 */
	static Answer postJson(String address, Map<String, String> headers, String json, Limits limits) throws IOException {
		return exchange(HttpMethod.POST, address, headers, json, limits);
	}

	private static Answer exchange(HttpMethod method, String address, Map<String, String> headers, @Nullable String json,
			Limits limits) throws IOException {
		long started = System.nanoTime();
		try {
			URI uri = URI.create(address);
			JdkClientHttpRequestFactory requests = new JdkClientHttpRequestFactory(transport(uri));
			requests.setReadTimeout(limits.timeout());
			RestClient.RequestBodySpec request = RestClient.builder()
				.requestFactory(requests)
				.build()
				.method(method)
				.uri(uri)
				.accept(MediaType.APPLICATION_JSON)
				.headers(sent -> headers.forEach(sent::set));
			if (json != null) {
				request.contentType(MediaType.APPLICATION_JSON).body(json);
			}
			// Read here, whatever the status: the default handling would put the provider's text in an exception.
			return request.exchange((asked, response) -> {
				try (InputStream body = response.getBody()) {
					return new Answer(response.getStatusCode().value(),
							bounded(body, limits, limits.timeout().toNanos() - (System.nanoTime() - started)));
				}
			});
		}
		catch (RestClientException | IllegalArgumentException unreachable) {
			throw new IOException("The provider did not answer");
		}
	}

	/** The JDK client a request to this address is sent with. */
	static HttpClient transport(URI uri) {
		return "https".equalsIgnoreCase(uri.getScheme()) ? SECURE : PLAIN;
	}

	/**
	 * Reads up to the bound. The read timeout resets with every byte, so a server that trickles its answer would hold
	 * the caller for ever: when what is left of the deadline runs out the stream is closed, which ends the read.
	 */
	private static byte[] bounded(InputStream body, Limits limits, long nanosLeft) throws IOException {
		AtomicBoolean expired = new AtomicBoolean();
		CompletableFuture<Void> deadline = CompletableFuture.runAsync(() -> {
			expired.set(true);
			try {
				body.close();
			}
			catch (IOException ignored) {
				// Closing is how the stalled read is released; nothing else to do.
			}
		}, CompletableFuture.delayedExecutor(Math.max(0, nanosLeft), TimeUnit.NANOSECONDS));
		try {
			byte[] read = body.readNBytes(limits.maxResponseBytes() + 1);
			if (expired.get()) {
				throw new IOException("The answer took longer than allowed");
			}
			return read;
		}
		catch (IOException failed) {
			throw expired.get() ? new IOException("The answer took longer than allowed") : failed;
		}
		finally {
			deadline.cancel(false);
		}
	}

}
