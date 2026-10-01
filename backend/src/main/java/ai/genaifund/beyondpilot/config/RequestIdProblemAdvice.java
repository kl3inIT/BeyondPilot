package ai.genaifund.beyondpilot.config;

import org.jspecify.annotations.Nullable;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/**
 * Adds the request identifier to every problem response, whichever handler produced it: a module failure, a Spring MVC
 * failure or the error endpoint.
 */
@RestControllerAdvice
class RequestIdProblemAdvice implements ResponseBodyAdvice<Object> {

	@Override
	public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
		return true;
	}

	@Override
	public @Nullable Object beforeBodyWrite(@Nullable Object body, MethodParameter returnType, MediaType contentType,
			Class<? extends HttpMessageConverter<?>> converterType, ServerHttpRequest request,
			ServerHttpResponse response) {
		if (body instanceof ProblemDetail problem && request instanceof ServletServerHttpRequest servletRequest) {
			String requestId = RequestIdFilter.requestId(servletRequest.getServletRequest());
			if (requestId != null) {
				problem.setProperty("requestId", requestId);
			}
		}
		return body;
	}
}
