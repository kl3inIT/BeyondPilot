package ai.genaifund.beyondpilot.identity.persistence;

import java.util.Locale;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** The database stores enum values as lowercase codes. */
final class LowercaseEnumConverters {

	private LowercaseEnumConverters() {
	}

	@Converter(autoApply = true)
	static final class Status implements AttributeConverter<AccountStatus, String> {

		@Override
		public String convertToDatabaseColumn(AccountStatus status) {
			return status.name().toLowerCase(Locale.ROOT);
		}

		@Override
		public AccountStatus convertToEntityAttribute(String code) {
			return AccountStatus.valueOf(code.toUpperCase(Locale.ROOT));
		}
	}

	@Converter(autoApply = true)
	static final class Role implements AttributeConverter<PlatformRole, String> {

		@Override
		public String convertToDatabaseColumn(PlatformRole role) {
			return role.name().toLowerCase(Locale.ROOT);
		}

		@Override
		public PlatformRole convertToEntityAttribute(String code) {
			return PlatformRole.valueOf(code.toUpperCase(Locale.ROOT));
		}
	}
}
