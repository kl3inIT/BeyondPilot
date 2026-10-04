package ai.genaifund.beyondpilot.storage.adapter;

import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalLong;

import ai.genaifund.beyondpilot.storage.StorageProperties;
import jakarta.annotation.PreDestroy;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * Keeps objects in one S3 bucket. The browser sends an upload straight to the bucket with a presigned address, and
 * reads through one, so the bytes never pass through this application. Credentials come from the default chain of
 * the AWS SDK: on AWS, the role of the instance or task.
 */
@Component
class S3ObjectStorageAdapter implements ObjectStorageAdapter {

	private final StorageProperties.S3 properties;

	// Built on first use: an environment that runs the local store configures no bucket and never reaches AWS.
	private volatile @Nullable S3Client client;

	private volatile @Nullable S3Presigner presigner;

	S3ObjectStorageAdapter(StorageProperties properties) {
		this.properties = properties.s3();
	}

	@Override
	public ObjectStorageProvider provider() {
		return ObjectStorageProvider.S3;
	}

	@Override
	public ObjectStorageProviderCapabilities capabilities() {
		return new ObjectStorageProviderCapabilities(false);
	}

	@Override
	public UploadTarget authorizeUpload(UploadSpecification specification) {
		// The media type and the exact length are signed: the bucket refuses an upload that differs from either.
		String url = presigner()
			.presignPutObject(presign -> presign.signatureDuration(specification.lifetime())
				.putObjectRequest(put -> put.bucket(bucket())
					.key(specification.objectKey())
					.contentType(specification.mediaType())
					.contentLength(specification.sizeBytes())))
			.url()
			.toString();
		return new UploadTarget("PUT", url, Map.of(HttpHeaders.CONTENT_TYPE, specification.mediaType()));
	}

	@Override
	public void write(String objectKey, InputStream content, long sizeBytes, String mediaType) {
		client().putObject(put -> put.bucket(bucket()).key(objectKey).contentType(mediaType),
				RequestBody.fromInputStream(content, sizeBytes));
	}

	@Override
	public OptionalLong size(String objectKey) {
		try {
			return OptionalLong.of(client().headObject(head -> head.bucket(bucket()).key(objectKey)).contentLength());
		}
		catch (NoSuchKeyException exception) {
			return OptionalLong.empty();
		}
	}

	@Override
	public byte[] firstBytes(String objectKey, int length) {
		return client()
			.getObjectAsBytes(get -> get.bucket(bucket()).key(objectKey).range("bytes=0-" + (length - 1)))
			.asByteArray();
	}

	@Override
	public Optional<URI> readAddress(String objectKey, String mediaType, @Nullable String downloadName,
			Duration lifetime) {
		String disposition = (downloadName != null ? ContentDisposition.attachment().filename(downloadName)
				: ContentDisposition.inline())
			.build()
			.toString();
		return Optional.of(URI.create(presigner()
			.presignGetObject(presign -> presign.signatureDuration(lifetime)
				.getObjectRequest(get -> get.bucket(bucket())
					.key(objectKey)
					.responseContentType(mediaType)
					.responseContentDisposition(disposition)))
			.url()
			.toString()));
	}

	@Override
	public InputStream open(String objectKey) {
		return client().getObject(get -> get.bucket(bucket()).key(objectKey));
	}

	@Override
	public void delete(String objectKey) {
		client().deleteObject(delete -> delete.bucket(bucket()).key(objectKey));
	}

	@PreDestroy
	void close() {
		S3Client openClient = client;
		if (openClient != null) {
			openClient.close();
		}
		S3Presigner openPresigner = presigner;
		if (openPresigner != null) {
			openPresigner.close();
		}
	}

	private String bucket() {
		return required(properties.bucket(), "beyondpilot.storage.s3.bucket");
	}

	private synchronized S3Client client() {
		S3Client existing = client;
		if (existing == null) {
			S3ClientBuilder builder = S3Client.builder().region(region());
			URI endpoint = endpoint();
			if (endpoint != null) {
				builder.endpointOverride(endpoint).forcePathStyle(true);
			}
			existing = builder.build();
			client = existing;
		}
		return existing;
	}

	private synchronized S3Presigner presigner() {
		S3Presigner existing = presigner;
		if (existing == null) {
			S3Presigner.Builder builder = S3Presigner.builder().region(region());
			URI endpoint = endpoint();
			if (endpoint != null) {
				builder.endpointOverride(endpoint)
					.serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
			}
			existing = builder.build();
			presigner = existing;
		}
		return existing;
	}

	/** An unset variable binds as an empty address, which is no endpoint. */
	private @Nullable URI endpoint() {
		URI endpoint = properties.endpoint();
		return endpoint != null && StringUtils.hasText(endpoint.toString()) ? endpoint : null;
	}

	private Region region() {
		return Region.of(required(properties.region(), "beyondpilot.storage.s3.region"));
	}

	/** The S3 store without its bucket or region does not guess: it stops. */
	private static String required(@Nullable String value, String property) {
		if (!StringUtils.hasText(value)) {
			throw new IllegalStateException(property + " must be set to use the S3 object store");
		}
		return value;
	}
}
