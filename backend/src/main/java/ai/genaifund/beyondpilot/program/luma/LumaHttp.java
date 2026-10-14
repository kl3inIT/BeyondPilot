package ai.genaifund.beyondpilot.program.luma;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.jspecify.annotations.Nullable;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * The calls to Luma. The addresses come from Luma's content, so a call goes only to a configured host, follows no
 * redirect, ends at its deadline counted to the last byte read, and stops reading at its bound. It follows
 * {@code ai.adapter.OutboundHttp}.
 */
public final class LumaHttp {

	private static final HttpClient CLIENT = HttpClient.newBuilder()
		.followRedirects(HttpClient.Redirect.NEVER)
		.connectTimeout(Duration.ofSeconds(5))
		.build();

	private final Set<String> hosts;

	private final Duration timeout;

	public LumaHttp(Set<String> hosts, Duration timeout) {
		this.hosts = Set.copyOf(hosts.stream().map(host -> host.toLowerCase(Locale.ROOT)).toList());
		this.timeout = timeout;
	}

	/**
	 * What Luma answered.
	 * @param mediaType the type the answer names, without its parameters; null when it names none
	 * @param body at most one byte more than the bound, so an answer that is too long can be told from one that fits
	 */
	public record Answer(int status, @Nullable String mediaType, byte[] body) {

		public boolean ok() {
			return status >= 200 && status < 300;
		}
	}

	/** Whether the address is one the job may call. */
	public boolean allowed(URI address) {
		String scheme = address.getScheme();
		String host = address.getHost();
		return scheme != null && host != null
				&& ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))
				&& hosts.contains(host.toLowerCase(Locale.ROOT));
	}

	/**
	 * @throws IOException when the host is not configured, or no answer came in time
	 */
	public Answer get(URI address, String accept, int maxBytes) throws IOException {
		if (!allowed(address)) {
			throw new IOException("Not a Luma address");
		}
		long started = System.nanoTime();
		try {
			JdkClientHttpRequestFactory requests = new JdkClientHttpRequestFactory(CLIENT);
			requests.setReadTimeout(timeout);
			return RestClient.builder()
				.requestFactory(requests)
				.build()
				.get()
				.uri(address)
				.header("Accept", accept)
				.header("User-Agent", "BeyondPilot (+https://beyondpilot.ai)")
				// Read here, whatever the status: the default handling would put Luma's text in an exception.
				.exchange((asked, response) -> {
					MediaType type = response.getHeaders().getContentType();
					try (InputStream body = response.getBody()) {
						return new Answer(response.getStatusCode().value(),
								type == null ? null : type.getType() + "/" + type.getSubtype(),
								bounded(body, maxBytes, timeout.toNanos() - (System.nanoTime() - started)));
					}
				});
		}
		catch (RestClientException | IllegalArgumentException unreachable) {
			throw new IOException("Luma did not answer");
		}
	}

	/**
	 * Reads up to the bound. The read timeout resets with every byte, so when what is left of the deadline runs out
	 * the stream is closed, which ends the read.
	 */
	private static byte[] bounded(InputStream body, int maxBytes, long nanosLeft) throws IOException {
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
			byte[] read = body.readNBytes(maxBytes + 1);
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
