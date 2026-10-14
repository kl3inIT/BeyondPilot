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

/**
 * A company gives its website and the year it was founded; a team, a builder on their own or any other organization
 * may leave them out. Each one a company lacks is refused at its own member, so the screen marks that field.
 */
@Documented
@Constraint(validatedBy = { RequiredOfCompany.OnCreate.class, RequiredOfCompany.OnSave.class,
		RequiredOfCompany.OnBasics.class })
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiredOfCompany {

	String message() default "is required of a company";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};

	class OnCreate implements ConstraintValidator<RequiredOfCompany, CreateOrganizationRequest> {

		@Override
		public boolean isValid(@Nullable CreateOrganizationRequest request, ConstraintValidatorContext context) {
			return request == null || Facts.given(request.type(), request.website(), request.foundedYear(), context);
		}

	}

	class OnSave implements ConstraintValidator<RequiredOfCompany, SaveOrganizationRequest> {

		@Override
		public boolean isValid(@Nullable SaveOrganizationRequest request, ConstraintValidatorContext context) {
			return request == null || Facts.given(request.type(), request.website(), request.foundedYear(), context);
		}

	}

	class OnBasics implements ConstraintValidator<RequiredOfCompany, SaveOrganizationBasicsRequest> {

		@Override
		public boolean isValid(@Nullable SaveOrganizationBasicsRequest request, ConstraintValidatorContext context) {
			return request == null || Facts.given(request.type(), request.website(), request.foundedYear(), context);
		}

	}

	/** The rule the profile and popup requests share. */
	final class Facts {

		private Facts() {
		}

		static boolean given(@Nullable String type, @Nullable String website, @Nullable Integer foundedYear,
				ConstraintValidatorContext context) {
			if (!"company".equals(type)) {
				return true;
			}
			boolean websiteMissing = website == null || website.isBlank();
			boolean yearMissing = foundedYear == null;
			if (websiteMissing || yearMissing) {
				context.disableDefaultConstraintViolation();
				if (websiteMissing) {
					refuse(context, "website");
				}
				if (yearMissing) {
					refuse(context, "foundedYear");
				}
			}
			return !websiteMissing && !yearMissing;
		}

		private static void refuse(ConstraintValidatorContext context, String member) {
			context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
				.addPropertyNode(member)
				.addConstraintViolation();
		}

	}

}
