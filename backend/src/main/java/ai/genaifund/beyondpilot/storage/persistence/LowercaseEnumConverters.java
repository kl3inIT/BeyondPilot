package ai.genaifund.beyondpilot.storage.persistence;

import java.util.Arrays;
import java.util.Locale;

import ai.genaifund.beyondpilot.storage.FilePurpose;
import ai.genaifund.beyondpilot.storage.adapter.ObjectStorageProvider;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** The database stores enum values as lowercase codes. */
final class LowercaseEnumConverters {

	private LowercaseEnumConverters() {
	}

	@Converter(autoApply = true)
	static final class Status implements AttributeConverter<FileStatus, String> {

		@Override
		public String convertToDatabaseColumn(FileStatus status) {
			return status.name().toLowerCase(Locale.ROOT);
		}

		@Override
		public FileStatus convertToEntityAttribute(String code) {
			return FileStatus.valueOf(code.toUpperCase(Locale.ROOT));
		}
	}

	@Converter(autoApply = true)
	static final class Provider implements AttributeConverter<ObjectStorageProvider, String> {

		@Override
		public String convertToDatabaseColumn(ObjectStorageProvider provider) {
			return provider.name().toLowerCase(Locale.ROOT);
		}

		@Override
		public ObjectStorageProvider convertToEntityAttribute(String code) {
			return ObjectStorageProvider.valueOf(code.toUpperCase(Locale.ROOT));
		}
	}

	@Converter(autoApply = true)
	static final class Purpose implements AttributeConverter<FilePurpose, String> {

		@Override
		public String convertToDatabaseColumn(FilePurpose purpose) {
			return purpose.value();
		}

		@Override
		public FilePurpose convertToEntityAttribute(String code) {
			return Arrays.stream(FilePurpose.values())
				.filter(purpose -> purpose.value().equals(code))
				.findFirst()
				.orElseThrow(() -> new IllegalArgumentException("Unknown file purpose " + code));
		}
	}
}
