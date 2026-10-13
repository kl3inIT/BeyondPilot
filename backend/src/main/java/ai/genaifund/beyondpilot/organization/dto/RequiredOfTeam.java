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

/** A team gives its experience separately from its short description on both profile surfaces. */
@Documented
@Constraint(validatedBy = { RequiredOfTeam.OnCreate.class, RequiredOfTeam.OnSave.class, RequiredOfTeam.OnBasics.class })
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiredOfTeam {
	String message() default "is required of a team";
	Class<?>[] groups() default {};
	Class<? extends Payload>[] payload() default {};

	class OnCreate implements ConstraintValidator<RequiredOfTeam, CreateOrganizationRequest> {
		@Override
		public boolean isValid(@Nullable CreateOrganizationRequest request, ConstraintValidatorContext context) {
			return request == null || Facts.given(request.type(), request.teamBackground(), context);
		}
	}

	class OnSave implements ConstraintValidator<RequiredOfTeam, SaveOrganizationRequest> {
		@Override
		public boolean isValid(@Nullable SaveOrganizationRequest request, ConstraintValidatorContext context) {
			return request == null || Facts.given(request.type(), request.teamBackground(), context);
		}
	}

	class OnBasics implements ConstraintValidator<RequiredOfTeam, SaveOrganizationBasicsRequest> {
		@Override
		public boolean isValid(@Nullable SaveOrganizationBasicsRequest request, ConstraintValidatorContext context) {
			return request == null || Facts.given(request.type(), request.teamBackground(), context);
		}
	}

	final class Facts {

		private Facts() {}

		static boolean given(@Nullable String type, @Nullable String background, ConstraintValidatorContext context) {
			if (!"builder_team".equals(type) || background != null && !background.isBlank()) {
				return true;
			}
			context.disableDefaultConstraintViolation();
			context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
				.addPropertyNode("teamBackground").addConstraintViolation();
			return false;
		}
	}
}
