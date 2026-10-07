package ai.genaifund.beyondpilot.identity.oauth;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.TimeUnit;

import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.util.Timeout;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * The only way the authorization server reads an address an outsider names: client ID metadata documents and the keys
 * a client signs with. It connects to public addresses only ({@link PublicAddresses}), follows no redirect, gives up
 * after five seconds and reads at most a set number of bytes.
 */
final class OutsideHttp {

	private static final Timeout FIVE_SECONDS = Timeout.of(5, TimeUnit.SECONDS);

	private OutsideHttp() {
	}

	/** A client that reads at most {@code maxBytes} of each answer; a longer one fails as it is read. */
	static RestClient client(int maxBytes) {
		return RestClient.builder().requestFactory(requests()).requestInterceptor(limit(maxBytes)).build();
	}

	private static HttpComponentsClientHttpRequestFactory requests() {
		CloseableHttpClient http = HttpClients.custom()
			.setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create()
				.setDnsResolver(new PublicAddresses())
				.setDefaultConnectionConfig(
						ConnectionConfig.custom().setConnectTimeout(FIVE_SECONDS).setSocketTimeout(FIVE_SECONDS).build())
				.build())
			.setDefaultRequestConfig(RequestConfig.custom()
				.setRedirectsEnabled(false)
				.setConnectionRequestTimeout(FIVE_SECONDS)
				.setResponseTimeout(FIVE_SECONDS)
				.build())
			.disableRedirectHandling()
			.disableCookieManagement()
			.disableAuthCaching()
			.build();
		return new HttpComponentsClientHttpRequestFactory(http);
	}

	private static ClientHttpRequestInterceptor limit(int maxBytes) {
		return (request, body, execution) -> {
			ClientHttpResponse response = execution.execute(request, body);
			return new ClientHttpResponse() {

				@Override
				public HttpStatusCode getStatusCode() throws IOException {
					return response.getStatusCode();
				}

				@Override
				public String getStatusText() throws IOException {
					return response.getStatusText();
				}

				@Override
				public HttpHeaders getHeaders() {
					return response.getHeaders();
				}

				@Override
				public InputStream getBody() throws IOException {
					return new Bounded(response.getBody(), maxBytes);
				}

				@Override
				public void close() {
					response.close();
				}

			};
		};
	}

	/** Fails once more than the limit has been read. */
	private static final class Bounded extends FilterInputStream {

		private long left;

		Bounded(InputStream in, int limit) {
			super(in);
			this.left = limit;
		}

		@Override
		public int read() throws IOException {
			int read = super.read();
			if (read >= 0) {
				spend(1);
			}
			return read;
		}

		@Override
		public int read(byte[] b, int off, int len) throws IOException {
			int read = super.read(b, off, len);
			if (read > 0) {
				spend(read);
			}
			return read;
		}

		private void spend(int bytes) throws IOException {
			left -= bytes;
			if (left < 0) {
				throw new IOException("The answer is longer than allowed");
			}
		}

	}

}
