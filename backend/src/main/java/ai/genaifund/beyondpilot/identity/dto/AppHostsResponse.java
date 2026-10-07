package ai.genaifund.beyondpilot.identity.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AppHosts", description = "Which AI apps may connect to the MCP servers.")
public record AppHostsResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether apps of hosts not in the list may connect, labelled Not reviewed.") boolean allowOtherHosts,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The hosts whose apps BeyondPilot has reviewed, in order of host.") List<Host> hosts) {

	@Schema(name = "AppHost")
	public record Host(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String host,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					description = "The names of the apps of this host that have signed in.") List<String> apps) {
	}

}
