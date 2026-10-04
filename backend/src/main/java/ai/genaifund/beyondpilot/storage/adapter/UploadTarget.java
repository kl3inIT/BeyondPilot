package ai.genaifund.beyondpilot.storage.adapter;

import java.util.Map;

/**
 * Where and how the browser sends the bytes of an upload.
 * @param url an address of the object store, or a path of this application
 * @param headers the headers the request must carry
 */
public record UploadTarget(String method, String url, Map<String, String> headers) {

	public UploadTarget {
		headers = Map.copyOf(headers);
	}
}
