# Identity: verification matrix

Boundaries follow [conventions › Testing](../conventions.md#testing). Sign-in is application composition, sessions and filters, so its tests start the full application and speak real HTTP against PostgreSQL; only the SMTP server is replaced.

| Contract | Regression it catches | Test |
| --- | --- | --- |
| An emailed link opens a session of the address; the email is in the asked language and carries the return path | A link that does not sign in, a wrong link address, a missing translation | `IdentitySignInTest.anEmailedLinkOpensASessionOfTheAddress` |
| A link works once | A reusable link | `IdentitySignInTest.aLinkWorksOnce` |
| An expired link is refused | A link that outlives its lifetime | `IdentitySignInTest.anExpiredLinkIsRefused` |
| The return path is a path of this origin | An open redirect through the emailed link | `IdentitySignInTest.anExternalSiteCannotBeTheReturnDestination` |
| A configured operator address is an operator from its first sign-in | Nobody can operate a new environment | `IdentitySignInTest.aConfiguredOperatorAddressIsAnOperatorFromItsFirstSignIn` |
| The link and Google reach one account of an address; a returning Google user is found by subject | A second, empty account for the same person | `IdentitySignInTest.googleAndTheLinkReachOneAccountOfAnAddress` |
| A first Google sign-in needs a verified address | Taking over an account with an unverified address | `IdentitySignInTest.aFirstGoogleSignInNeedsAVerifiedAddress` |
| A disabled account cannot sign in and its open session stops | A disabled account that keeps working | `IdentitySignInTest.aDisabledAccountCannotSignInAndItsOpenSessionStops` |
| Signing out ends the session | A cookie that still works after sign-out | `IdentitySignInTest.signingOutEndsTheSession` |
| Only a POST signs out | A link on another site that ends a session | `IdentitySignInTest.aLinkToTheSignOutAddressDoesNotSignOut` |
| Without a session, an API path answers a 401 problem | An open API path, or a refusal that is not a problem | `IdentitySignInTest.nobodySignedInIsAnUnauthorizedProblem`, `ProblemResponsesTest.anApiPathWithoutASessionIsAnUnauthorizedProblem` |
| A state-changing request without the CSRF header is refused | A cross-site form that acts for a signed-in person | `IdentitySignInTest.aStateChangingRequestWithoutTheCsrfHeaderIsRefused`, `ProblemResponsesTest.aStateChangingRequestWithoutTheCsrfHeaderIsAForbiddenProblem` |
| An address holds at most three working links; the refusal says when to retry | Flooding a mailbox; a 429 without `Retry-After` | `IdentitySignInTest.anAddressGetsALimitedNumberOfWorkingLinks` |
| Requests for one address that arrive together send at most three emails | A limit that concurrent requests slip past | `IdentitySignInTest.requestsThatArriveTogetherDoNotExceedTheLimit` |
| No spelling of the link address gets around the checks | A path variant that reaches Spring Security's filter but not the guard | `IdentitySignInTest.noSpellingOfTheLinkAddressGetsAroundTheChecks` |
| A malformed or overlong address is refused | Mail sent to nonsense; a server error on a long value | `IdentitySignInTest.aMalformedAddressIsRefused` |
| Choosing Google redirects to Google and remembers a path of this origin only | A broken start of the round trip, an open redirect after it | `GoogleSignInStartTest` |
| The session cookie is `HttpOnly` and `SameSite=Lax` | A cookie readable by scripts or sent across sites | Asserted on every redemption in `IdentitySignInTest` |
| The modules are closed and `identity` depends only on `notification` | A new dependency edge | `ModulithArchitectureTest` |
| `openapi.yml` describes `GET /api/identity/me` | A stale contract | `OpenApiContractTest` |

## Not automated

| Contract | How it is checked |
| --- | --- |
| The return from Google: the account is found or created and the person lands on the remembered path | By hand on an environment with a real OAuth client, after every change to `SecurityConfiguration` or `GoogleOidcUserService` |
| Delivery through the real mail provider | By hand on the deployed environment; locally Mailpit receives the email |
