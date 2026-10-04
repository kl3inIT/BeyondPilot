package ai.genaifund.beyondpilot.program.persistence;

import java.util.Locale;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** The database stores enum values as lowercase codes. */
final class LowercaseEnumConverters {

	private LowercaseEnumConverters() {
	}

	@Converter(autoApply = true)
	static final class Type implements AttributeConverter<ProgramType, String> {

		@Override
		public String convertToDatabaseColumn(ProgramType type) {
			return type.code();
		}

		@Override
		public ProgramType convertToEntityAttribute(String code) {
			return ProgramType.of(code);
		}
	}

	@Converter(autoApply = true)
	static final class Status implements AttributeConverter<ProgramStatus, String> {

		@Override
		public String convertToDatabaseColumn(ProgramStatus status) {
			return status.code();
		}

		@Override
		public ProgramStatus convertToEntityAttribute(String code) {
			return ProgramStatus.valueOf(code.toUpperCase(Locale.ROOT));
		}
	}

	@Converter(autoApply = true)
	static final class Kind implements AttributeConverter<PageKind, String> {

		@Override
		public String convertToDatabaseColumn(PageKind kind) {
			return kind.code();
		}

		@Override
		public PageKind convertToEntityAttribute(String code) {
			return PageKind.valueOf(code.toUpperCase(Locale.ROOT));
		}
	}
}
