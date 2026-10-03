package ai.genaifund.beyondpilot.identity;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import io.swagger.v3.oas.annotations.Parameter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

/**
 * Binds a controller parameter of type {@link Actor} to the signed-in account. It never appears in the API contract.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@AuthenticationPrincipal(expression = "actor")
@Parameter(hidden = true)
public @interface CurrentActor {
}
