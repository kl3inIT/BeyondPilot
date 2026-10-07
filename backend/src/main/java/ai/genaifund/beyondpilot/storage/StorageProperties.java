package ai.genaifund.beyondpilot.storage;

import java.net.URI;
import java.nio.file.Path;
import java.time.Duration;

import ai.genaifund.beyondpilot.storage.adapter.ObjectStorageProvider;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;
import org.springframework.validation.annotation.Validated;

/**
 * @param provider the object store new uploads go to; files already stored stay readable from their own store
 * @param ticketLifetime how long an upload may take between reserving it and sending the bytes
 * @param readAddressLifetime how long a direct read address of an object store works
 * @param programImageMaxSize the largest image of a program
 * @param applicationFileMaxSize the largest file of an application
 * @param solutionDeckMaxSize the largest deck of a solution
 * @param solutionLogoMaxSize the largest logo of a solution
 * @param solutionImageMaxSize the largest cover of a solution, and the largest image under it
 * @param useCaseAttachmentMaxSize the largest file attached to a use case
 * @param talentPhotoMaxSize the largest photo of a talent profile
 * @param organizationLogoMaxSize the largest logo of an organization
 * @param local the directory of the local store
 * @param s3 the bucket of the S3 store; credentials come from the AWS SDK's default chain, never from here
 */
@Validated
@ConfigurationProperties("beyondpilot.storage")
public record StorageProperties(ObjectStorageProvider provider, @DefaultValue("15m") Duration ticketLifetime,
		@DefaultValue("1h") Duration readAddressLifetime, @DefaultValue("5MB") DataSize programImageMaxSize,
		@DefaultValue("25MB") DataSize applicationFileMaxSize, @DefaultValue("100MB") DataSize solutionDeckMaxSize,
		@DefaultValue("2MB") DataSize solutionLogoMaxSize, @DefaultValue("5MB") DataSize solutionImageMaxSize,
		@DefaultValue("2MB") DataSize talentPhotoMaxSize, @DefaultValue("5MB") DataSize organizationLogoMaxSize,
		@DefaultValue("25MB") DataSize useCaseAttachmentMaxSize,
		@DefaultValue Local local, @DefaultValue S3 s3) {

	long maxSizeBytes(FilePurpose purpose) {
		return switch (purpose) {
			case PROGRAM_IMAGE -> programImageMaxSize.toBytes();
			case APPLICATION_FILE -> applicationFileMaxSize.toBytes();
			case SOLUTION_DECK -> solutionDeckMaxSize.toBytes();
			case SOLUTION_LOGO -> solutionLogoMaxSize.toBytes();
			case SOLUTION_IMAGE -> solutionImageMaxSize.toBytes();
			case TALENT_PHOTO -> talentPhotoMaxSize.toBytes();
			case USE_CASE_ATTACHMENT -> useCaseAttachmentMaxSize.toBytes();
			case ORGANIZATION_LOGO -> organizationLogoMaxSize.toBytes();
		};
	}

	public record Local(@DefaultValue("build/storage") Path directory) {
	}

	/**
	 * @param endpoint another S3-compatible endpoint, addressed by path; absent for AWS
	 */
	public record S3(@Nullable String bucket, @Nullable String region, @Nullable URI endpoint) {
	}
}
