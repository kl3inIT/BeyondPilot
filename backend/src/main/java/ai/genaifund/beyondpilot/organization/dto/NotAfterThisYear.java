package ai.genaifund.beyondpilot.organization.dto;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.time.Year;
import java.time.ZoneId;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import org.jspecify.annotations.Nullable;

/** A year that has come: this year in Vietnam, or one before it. A missing year is another constraint's to refuse. */
@Documented
@Constraint(validatedBy = NotAfterThisYear.Validator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT })
@Retention(RetentionPolicy.RUNTIME)
public @interface NotAfterThisYear {

	String message() default "must not be after this year";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};

	class Validator implements ConstraintValidator<NotAfterThisYear, Integer> {

		private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

		@Override
		public boolean isValid(@Nullable Integer year, ConstraintValidatorContext context) {
			return year == null || year <= Year.now(context.getClockProvider().getClock().withZone(ZONE)).getValue();
		}

	}

}
