package ai.genaifund.beyondpilot.ai.adapter;

import java.io.IOException;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;

import ai.genaifund.beyondpilot.ai.adapter.OcrProviderException.Failure;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * AI Hay's OCR ({@code POST /v1/ocr}): one JPEG or PNG as base64 in, the picture's text as Markdown out. The kind of
 * a failure is read from the status, never from what the service wrote.
 */
@Component
class AiHayOcrAdapter implements OcrAdapter {

	static final String TYPE = "aihay";

	/** AI Hay refuses a body over 2 MB, counted in its JSON characters, and base64 adds a third. */
	private static final int MAX_PICTURE_BYTES = 1_400_000;

	/** A page of text is a few kilobytes; the cap bounds a hostile endpoint. */
	private static final int MAX_ANSWER_BYTES = 4 * 1_048_576;

	private static final JsonMapper JSON = JsonMapper.builder().build();

	@Override
	public String type() {
		return TYPE;
	}

	@Override
	public int maxPictureBytes() {
		return MAX_PICTURE_BYTES;
	}

	@Override
	public String read(OcrConnection connection, byte[] picture, Duration timeout) {
		// Base64 holds no character JSON would escape.
		String body = "{\"image\":\"" + Base64.getEncoder().encodeToString(picture) + "\"}";
		OutboundHttp.Answer answer;
		try {
			answer = OutboundHttp.postJson(ChatEndpoints.base(connection.baseUrl()) + "/v1/ocr",
					Map.of("Authorization", "Bearer " + connection.apiKey()), body,
					new OutboundHttp.Limits(timeout, MAX_ANSWER_BYTES));
		}
		catch (IOException unreachable) {
			throw new OcrProviderException(Failure.UNREACHABLE);
		}
		int status = answer.status();
		if (status == 401 || status == 403) {
			throw new OcrProviderException(Failure.CREDENTIAL_REJECTED, status);
		}
		if (status == 400 || status == 413) {
			throw new OcrProviderException(Failure.PICTURE_REFUSED, status);
		}
		if (status == 429 || status >= 500) {
			throw new OcrProviderException(Failure.UNREACHABLE, status);
		}
		if (status != 200) {
			throw new OcrProviderException(Failure.INCOMPATIBLE, status);
		}
		if (answer.body().length == 0 || answer.body().length > MAX_ANSWER_BYTES) {
			throw new OcrProviderException(Failure.INCOMPATIBLE);
		}
		return text(answer.body());
	}

	/** {@code result.text} of the answer; a picture without text gives an empty string. */
	static String text(byte[] answer) {
		JsonNode text;
		try {
			text = JSON.readTree(answer).path("result").path("text");
		}
		catch (JacksonException notJson) {
			throw new OcrProviderException(Failure.INCOMPATIBLE);
		}
		if (!text.isString()) {
			throw new OcrProviderException(Failure.INCOMPATIBLE);
		}
		return text.asString();
	}

}
