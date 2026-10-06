package ai.genaifund.beyondpilot.talent.web;

import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.CurrentActor;
import ai.genaifund.beyondpilot.talent.TalentAdministration;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentEnquiryListRequest;
import ai.genaifund.beyondpilot.talent.dto.AdminTalentEnquiryListResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The messages people behind talent profiles reported as unwanted, for operators to read. */
@RestController
@RequestMapping("/api/talent/admin/reported-enquiries")
@Tag(name = "Talent administration", description = "The talent profiles operators review.")
@ApiResponse(responseCode = "401", description = "Nobody is signed in.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminTalentController.PROBLEM)))
@ApiResponse(responseCode = "403", description = "The caller is not an operator.",
		content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
				schema = @Schema(ref = AdminTalentController.PROBLEM)))
class AdminTalentEnquiriesController {

	private final TalentAdministration talent;

	AdminTalentEnquiriesController(TalentAdministration talent) {
		this.talent = talent;
	}

	@GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(operationId = "listReportedTalentEnquiries",
			summary = "The messages reported through talent profiles, the most recently reported first",
			security = @SecurityRequirement(name = "session"))
	@ApiResponse(responseCode = "200", description = "One page of the reported messages.")
	@ApiResponse(responseCode = "400", description = "A parameter is not valid.",
			content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE,
					schema = @Schema(ref = AdminTalentController.PROBLEM)))
	AdminTalentEnquiryListResponse list(@CurrentActor Actor actor,
			@Valid @ParameterObject AdminTalentEnquiryListRequest request) {
		return talent.reported(actor, request);
	}
}
