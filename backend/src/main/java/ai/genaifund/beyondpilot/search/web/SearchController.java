package ai.genaifund.beyondpilot.search.web;

import ai.genaifund.beyondpilot.search.SearchService;
import ai.genaifund.beyondpilot.search.dto.SearchRequest;
import ai.genaifund.beyondpilot.search.dto.SearchResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Search over what the public site shows, without a session. */
@RestController
@RequestMapping("/api/search")
@Tag(name = "Search", description = "Search over the programs, solutions and talent the public site shows.")
class SearchController {

	private static final String PROBLEM = "#/components/schemas/Problem";

	private final SearchService search;

	SearchController(SearchService search) {
		this.search = search;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "search", summary = "What matches the query, best first",
			description = "Matches words with or without Vietnamese marks, the start of the last word, and typos in titles.")
	@ApiResponse(responseCode = "200", description = "A page of results and the counts of every kind.")
	@ApiResponse(responseCode = "400", description = "The query is missing or too long, or a parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE, schema = @Schema(ref = PROBLEM)))
	SearchResponse search(@Valid @ParameterObject SearchRequest request) {
		return search.search(request);
	}

}
