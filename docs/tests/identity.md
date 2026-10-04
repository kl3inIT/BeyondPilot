# Identity: verification matrix

Boundaries follow [conventions › Testing](../conventions.md#testing). Sign-in is application composition, sessions and filters, so its tests start the full application and speak real HTTP against PostgreSQL; only the SMTP server is replaced. The web screens are covered by `web/tests/e2e/sign-in.spec.ts`, with the backend's answers stood in for. The header of a signed-in person, its account menu and signing out are covered by `web/tests/e2e/header.spec.ts`; the header reads the session on the web server, so that run starts `tests/e2e/stub-backend.mjs`, which answers `/api/identity/me` by the value of the session cookie. Who may open the admin area is covered by `web/tests/e2e/admin.spec.ts` against the same stub: a visitor is redirected to sign in and back, in both locales; an account that is not an operator gets the 404 any unknown address gets; an operator gets the page, marked `noindex`. The same file covers the admin frame: the sidebar marks the current page, stays collapsed to icons across a reload and keeps its names; on a phone it opens as a sheet; signing out from its account menu leads to sign in.

## Backend

| Contract | Regression it catches | Test (`IdentitySignInTest` unless named) |
| --- | --- | --- |
| A code typed in the browser that asked opens a session of the address; the email is in the asked language | A code that does not sign in, a missing translation, a session not replaced on sign-in | `aCodeTypedInTheBrowserThatAskedOpensASessionOfTheAddress` |
| A code is worth nothing outside the browser that asked for it, and trying it there neither spends nor counts against it | Signing someone into another person's account with a forwarded code; guessing at or blocking a code from elsewhere | `aCodeIsWorthNothingOutsideTheBrowserThatAskedForIt` |
| A code works once | A reusable code | `aCodeWorksOnce` |
| An expired code is refused | A code that outlives its lifetime | `anExpiredCodeIsRefused` |
| Five wrong codes stop the code, also for the right one | Unlimited guessing | `wrongCodesStopTheCodeFromWorking` |
| Guesses sent together get no more turns than guesses sent in a row | A limit that concurrent guesses outrun | `guessesSentTogetherGetNoMoreTurnsThanGuessesSentInARow` |
| An address that keeps getting wrong codes gets no new code for a day | Slow guessing over many codes | `anAddressThatKeepsGettingWrongCodesGetsNoNewCodeForADay` |
| A new code replaces the one before it in the same browser | An older code that still signs in | `aNewCodeReplacesTheOneBeforeItInTheSameBrowser` |
| The code is stored as a hash | A database copy that reveals working codes | `theCodeIsNotStoredAsSent` |
| An address holds at most three working codes; the refusal says when to retry | Flooding a mailbox; a 429 without `Retry-After` | `anAddressGetsALimitedNumberOfWorkingCodes` |
| Requests for one address that arrive together send at most three emails | A limit that concurrent requests slip past | `requestsThatArriveTogetherDoNotExceedTheLimit` |
| No spelling of the code request address gets around the checks | A path variant that reaches Spring Security's filter but not the guard | `noSpellingOfTheCodeRequestAddressGetsAroundTheChecks` |
| A value that is not a plain address is refused and nothing is stored for it | Mail sent to nonsense, header injection, a full table | `aMalformedAddressIsRefused` |
| A configured operator address is an operator from its first sign-in | Nobody can operate a new environment | `aConfiguredOperatorAddressIsAnOperatorFromItsFirstSignIn` |
| The code and Google reach one account of an address; a returning Google user is found by subject | A second, empty account for the same person | `googleAndTheCodeReachOneAccountOfAnAddress` |
| A first Google sign-in needs a verified address | Taking over an account with an unverified address | `aFirstGoogleSignInNeedsAVerifiedAddress` |
| A disabled account cannot sign in and its open session stops | A disabled account that keeps working | `aDisabledAccountCannotSignInAndItsOpenSessionStops` |
| Signing out ends the session; only a POST signs out | A cookie that still works after sign-out; a page of another site that ends a session | `signingOutEndsTheSession`, `aLinkToTheSignOutAddressDoesNotSignOut` |
| Without a session, an API path answers a 401 problem | An open API path, or a refusal that is not a problem | `nobodySignedInIsAnUnauthorizedProblem`, `ProblemResponsesTest.anApiPathWithoutASessionIsAnUnauthorizedProblem` |
| A state-changing request without the CSRF header is refused | A cross-site form that acts for a signed-in person | `aStateChangingRequestWithoutTheCsrfHeaderIsRefused`, `ProblemResponsesTest.aStateChangingRequestWithoutTheCsrfHeaderIsAForbiddenProblem` |
| Choosing Google redirects to Google and remembers a path of this origin only | A broken start of the round trip, an open redirect after it | `GoogleSignInStartTest` |
| The session cookie is `HttpOnly` and `SameSite=Lax` | A cookie readable by scripts or sent across sites | Asserted on every session in `IdentitySignInTest` |
| The modules are closed and `identity` depends only on `notification` | A new dependency edge | `ModulithArchitectureTest` |
| `openapi.yml` describes `GET /api/identity/me` | A stale contract | `OpenApiContractTest` |

## Not automated

| Contract | How it is checked |
| --- | --- |
| The return from Google: the account is found or created and the person lands on the remembered path | By hand on an environment with a real OAuth client, after every change to `SecurityConfiguration` or `GoogleOidcUserService` |
| Delivery through the real mail provider | By hand on the deployed environment; locally Mailpit receives the email |
