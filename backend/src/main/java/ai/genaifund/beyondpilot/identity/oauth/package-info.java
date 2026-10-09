/**
 * The authorization server AI apps sign in through to reach BeyondPilot's MCP servers (BEY-78): Spring Security's, in
 * this application, reusing its sign-in. Apps identify themselves by a client ID metadata document from a trusted host,
 * or by a client BeyondPilot registered for them; access tokens are signed JWTs bound to one server.
 */
@NullMarked
package ai.genaifund.beyondpilot.identity.oauth;

import org.jspecify.annotations.NullMarked;
