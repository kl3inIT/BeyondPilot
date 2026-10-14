package ai.genaifund.beyondpilot.organization.dto;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import org.jspecify.annotations.Nullable;

/** A team or company describes itself; a builder on their own gives only a name and country. */
@Documented
@Constraint(validatedBy = RequiredOrganizationDescription.Validator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiredOrganizationDescription {
	String message() default "is required of a team or company";
	Class<?>[] groups() default {};
	Class<? extends Payload>[] payload() default {};

	class Validator implements ConstraintValidator<RequiredOrganizationDescription, SaveOrganizationBasicsRequest> {
		@Override
		public boolean isValid(@Nullable SaveOrganizationBasicsRequest request, ConstraintValidatorContext context) {
			if (request == null || "independent_builder".equals(request.type())
					|| request.description() != null && !request.description().isBlank()) {
				return true;
			}
			context.disableDefaultConstraintViolation();
			context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
				.addPropertyNode("description").addConstraintViolation();
			return false;
		}
	}
}
