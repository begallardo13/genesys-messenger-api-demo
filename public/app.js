// ============================================================
// Auth0 SPA configuration
// ============================================================

// Auth0 application used by our normal website login.
const auth0Config = {
    domain: "begallardo.us.auth0.com",

    // Public SPA client ID.
    clientId: "18x4fdXSQJWKAGiGuQ78E2E5miScZ1EG",

    authorizationParams: {
        // Normal website Auth0 callback.
        redirect_uri:
            window.location.origin + "/callback",

        // Request an access token for our Customer API.
        audience:
            "https://genesys-messenger-api"
    }
};


// ============================================================
// Genesys Auth0 configuration
// ============================================================

// Separate Auth0 application used by
// Genesys Authenticated Web Messaging.
//
// IMPORTANT:
// The Auth0 client secret is never placed in this file.
const genesysAuth0Domain =
    "begallardo.us.auth0.com";

const genesysAuth0ClientId =
    "zH9WQuQVnBpUJwa3ccmAFmmo0ljuHJmO";


// ============================================================
// Application state
// ============================================================

// Auth0 SPA client for our normal website authentication.
let auth0Client = null;

// Access token for our Customer API.
let auth0AccessToken = null;

// Customer returned by our protected API.
let loggedInCustomer = null;

// Indicates that a Genesys Auth0 authorization code
// is available for Messenger.
let genesysAuthenticated =
    sessionStorage.getItem(
        "genesys_auth_code"
    ) !== null;

// Tracks whether the user explicitly requested a Genesys conversation.
// This prevents AuthProvider startup from redirecting to Auth0.
let genesysChatRequested = false;


// ============================================================
// DOM references
// ============================================================

const customerInfo =
    document.getElementById("customerInfo");

const auth0LoginButton =
    document.getElementById("auth0LoginButton");

const chatButton =
    document.getElementById("chatButton");


// ============================================================
// Normal Auth0 SPA — Get API access token
// ============================================================

async function getAuth0AccessToken() {

    try {

        // Request an access token for our Customer API.
        //
        // getTokenWithPopup is being used because our
        // localhost environment previously required
        // interactive consent.
        auth0AccessToken =
            await auth0Client.getTokenWithPopup({

                authorizationParams: {
                    audience:
                        "https://genesys-messenger-api",

                    scope:
                        "read:customer"
                }
            });


        console.log(
            "Auth0 access token received."
        );


        return auth0AccessToken;

    } catch (error) {

        console.error(
            "Unable to obtain Auth0 access token:",
            error
        );

        throw error;
    }
}


// ============================================================
// Normal Auth0 SPA — Initialize
// ============================================================

async function initializeAuth0() {

    // Create the normal Auth0 SPA client.
    auth0Client =
        await auth0.createAuth0Client(
            auth0Config
        );


    console.log(
        "Auth0 client initialized."
    );


    // IMPORTANT:
    //
    // Only /callback belongs to our normal Auth0 SPA.
    //
    // /genesys-callback belongs to the separate Auth0
    // application used by Genesys Messenger.
    const hasAuthCallback =
        window.location.pathname === "/callback" &&
        window.location.search.includes("code=") &&
        window.location.search.includes("state=");


    if (hasAuthCallback) {

        try {

            // Process the normal website Auth0 callback.
            await auth0Client.handleRedirectCallback();


            console.log(
                "Auth0 callback processed."
            );


            // Remove authorization parameters from
            // the browser address bar.
            window.history.replaceState(
                {},
                document.title,
                "/"
            );

        } catch (error) {

            console.error(
                "Auth0 callback processing failed:",
                error
            );


            window.history.replaceState(
                {},
                document.title,
                "/"
            );
        }
    }


    // Check normal website authentication status.
    const isAuthenticated =
        await auth0Client.isAuthenticated();


    console.log(
        "Authenticated:",
        isAuthenticated
    );


    // Enable the normal Auth0 login button.
    if (auth0LoginButton) {

        auth0LoginButton.disabled = false;
    }


    // Only continue to retrieve the customer profile when
    // this page load came from an Auth0 login callback.
    // This prevents an existing Auth0 session from
    // automatically logging the user in when they revisit the site.
    if (!isAuthenticated || !hasAuthCallback) {

        return;
    }


    // Retrieve the authenticated Auth0 user.
    const user =
        await auth0Client.getUser();


    console.log(
        "Authenticated Auth0 user:",
        user
    );


    try {

        // Obtain an access token for our Customer API.
        const accessToken =
            await getAuth0AccessToken();


        // Call the protected current-customer endpoint.
        const customerResponse =
            await fetch(
                "/api/me",
                {
                    headers: {
                        "Authorization":
                            `Bearer ${accessToken}`
                    }
                }
            );


        if (!customerResponse.ok) {

            console.error(
                "Unable to retrieve authenticated customer."
            );


            customerInfo.innerHTML =
                "<p>Unable to retrieve your customer information.</p>";


            return;
        }


        // Convert the API response to a JavaScript object.
        const customer =
            await customerResponse.json();


        // Store the customer returned by our protected REST API.
        // This proves that Auth0 authentication can be used to
        // retrieve application-specific customer information.
        loggedInCustomer =
            customer;


        // Display the actual Auth0 identity in the profile card.
        // The unique ID comes from the Auth0 "sub" claim.
        // The name and email come directly from the Auth0 profile.
        customerInfo.innerHTML = `
            <h3>Authenticated Identity</h3>
            <p><strong>ID:</strong> ${user.sub}</p>
            <p><strong>Name:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
`       ;


        console.log(
            "Customer retrieved from /api/me:",
            customer
        );

    } catch (error) {

        console.error(
            "Unable to retrieve customer:",
            error
        );


        customerInfo.innerHTML =
            "<p>Unable to retrieve customer information.</p>";
    }
}


// ============================================================
// Normal Auth0 SPA — Login
// ============================================================

async function loginWithAuth0() {

    try {

        // Redirect the user to Auth0 Universal Login.
        await auth0Client.loginWithRedirect();

    } catch (error) {

        console.error(
            "Auth0 login failed:",
            error
        );
    }
}


// ============================================================
// PKCE — Generate random value
// ============================================================

function generateRandomString(
    byteLength = 64
) {

    // Create an array for cryptographically secure
    // random bytes.
    const randomBytes =
        new Uint8Array(byteLength);


    // Fill the array with secure random values.
    crypto.getRandomValues(
        randomBytes
    );


    // Convert the random bytes to Base64.
    const base64String =
        btoa(
            String.fromCharCode(
                ...randomBytes
            )
        );


    // Convert Base64 to Base64URL format.
    return base64String
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


// ============================================================
// PKCE — Create code challenge
// ============================================================

async function createCodeChallenge(
    codeVerifier
) {

    // Convert the verifier into bytes.
    const data =
        new TextEncoder().encode(
            codeVerifier
        );


    // Hash the verifier with SHA-256.
    const digest =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );


    // Convert the hash into Base64.
    const base64String =
        btoa(
            String.fromCharCode(
                ...new Uint8Array(digest)
            )
        );


    // Convert Base64 to Base64URL.
    return base64String
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


// ============================================================
// Genesys Auth0 — Start authentication
// ============================================================

async function startGenesysAuthentication() {

    // Genesys-specific Auth0 callback.
    const redirectUri =
        window.location.origin +
        "/genesys-callback";


    // OAuth state protects against CSRF.
    const state =
        generateRandomString(32);


    // OIDC nonce protects the authentication response.
    const nonce =
        generateRandomString(32);


    // PKCE verifier is kept by the browser.
    const codeVerifier =
        generateRandomString(64);


    // Create the SHA-256 PKCE challenge.
    const codeChallenge =
        await createCodeChallenge(
            codeVerifier
        );


    // Store authentication information so that
    // getAuthCode can provide it to Genesys later.
    sessionStorage.setItem(
        "genesys_auth_state",
        state
    );

    sessionStorage.setItem(
        "genesys_auth_nonce",
        nonce
    );

    sessionStorage.setItem(
        "genesys_code_verifier",
        codeVerifier
    );


    // Build the Auth0 authorization URL.
    const authorizationUrl =
        new URL(
            `https://${genesysAuth0Domain}/authorize`
        );


    // Use the OAuth Authorization Code flow.
    authorizationUrl.searchParams.set(
        "response_type",
        "code"
    );


    // Use the Genesys Auth0 application's client ID.
    authorizationUrl.searchParams.set(
        "client_id",
        genesysAuth0ClientId
    );


    // Use the Genesys-specific callback.
    authorizationUrl.searchParams.set(
        "redirect_uri",
        redirectUri
    );


    // Request the OIDC identity scopes required by Genesys.
    authorizationUrl.searchParams.set(
        "scope",
        "openid email profile"
    );


    // Include the CSRF protection value.
    authorizationUrl.searchParams.set(
        "state",
        state
    );


    // Include the OIDC nonce.
    authorizationUrl.searchParams.set(
        "nonce",
        nonce
    );


    // Include the PKCE challenge.
    authorizationUrl.searchParams.set(
        "code_challenge",
        codeChallenge
    );


    // Tell Auth0 that S256 was used.
    authorizationUrl.searchParams.set(
        "code_challenge_method",
        "S256"
    );


    console.log(
        "Starting Genesys Auth0 authentication."
    );


    console.log(
        "Genesys Auth0 redirect URI:",
        redirectUri
    );


    // Redirect the browser to Auth0.
    window.location.assign(
        authorizationUrl.toString()
    );
}


// ============================================================
// Genesys Auth0 — Prepare callback
// ============================================================
//
// IMPORTANT:
//
// This runs BEFORE AuthProvider is registered.
//
// Genesys can request getAuthCode very early, so the
// authorization code must already be available.

function prepareGenesysCallback() {

    // Only process the Genesys callback route.
    if (
        window.location.pathname !==
        "/genesys-callback"
    ) {

        return;
    }


    // Read the Auth0 callback parameters.
    const params =
        new URLSearchParams(
            window.location.search
        );


    // Authorization code returned by Auth0.
    const code =
        params.get("code");


    // State returned by Auth0.
    const returnedState =
        params.get("state");


    // State originally generated by our application.
    const expectedState =
        sessionStorage.getItem(
            "genesys_auth_state"
        );


    // Stop if Auth0 did not return a code.
    if (!code) {

        console.error(
            "Genesys Auth0 callback did not contain an authorization code."
        );

        return;
    }


    // Validate the OAuth state.
    if (
        !returnedState ||
        !expectedState ||
        returnedState !== expectedState
    ) {

        console.error(
            "Genesys Auth0 callback state validation failed."
        );

        return;
    }


    // Store the authorization code.
    sessionStorage.setItem(
        "genesys_auth_code",
        code
    );


    // The authorization code is now available
    // for the Genesys AuthProvider.
    genesysAuthenticated = true;


    console.log(
        "Genesys Auth0 authorization code prepared."
    );


    console.log(
        "Genesys Auth0 callback state validated."
    );
}


// Prepare the Genesys callback BEFORE registering
// the AuthProvider plugin.
prepareGenesysCallback();


// ============================================================
// Genesys AuthProvider
// ============================================================

window.Genesys(
    "registerPlugin",
    "AuthProvider",
    (AuthProvider) => {

        console.log(
            "Genesys AuthProvider plugin initialized."
        );


        // ----------------------------------------------------
        // Genesys requests an authorization code.
        // ----------------------------------------------------

        AuthProvider.registerCommand(
            "getAuthCode",
            (event) => {

                console.log(
                    "Genesys requested an authorization code."
                );


                // Check whether Genesys is requesting
                // a completely new authentication flow.
                const forceUpdate =
                    event.data &&
                    event.data.forceUpdate;


                if (forceUpdate) {

                    console.log(
                        "Genesys requested fresh authentication."
                    );


                    // Start a new Auth0 authentication flow.
                    startGenesysAuthentication();


                    // Auth0 will redirect the browser,
                    // so there is no code to resolve yet.
                    event.resolve();

                    return;
                }


                // Retrieve the authorization code that was
                // prepared before AuthProvider initialized.
                const authCode =
                    sessionStorage.getItem(
                        "genesys_auth_code"
                    );


                // Retrieve the PKCE verifier associated
                // with this authorization code.
                const codeVerifier =
                    sessionStorage.getItem(
                        "genesys_code_verifier"
                    );


                // Retrieve the OIDC nonce.
                const nonce =
                    sessionStorage.getItem(
                        "genesys_auth_nonce"
                    );


                // Genesys expects the same redirect URI
                // used during the Auth0 authorization request.
                const redirectUri =
                    window.location.origin +
                    "/genesys-callback";


                // If Genesys does not have an authorization code yet,
                // start the Genesys-specific Auth0 login flow.
                if (!authCode || !nonce) {

    // Do not redirect during page startup.
    // Authentication is only started after the user
    // explicitly requests a Genesys conversation.
    if (!genesysChatRequested) {

        console.log(
            "Genesys authentication requested during startup. Waiting for user action."
        );

        // Resolve without starting Auth0 authentication.
        event.resolve();

        return;
    }

    console.log(
        "User requested a conversation. Starting Genesys authentication."
    );

    // Redirect to Auth0 to obtain the authorization code.
    startGenesysAuthentication();

    // The browser will navigate away, so there is no
    // authentication data to resolve at this moment.
    event.resolve();

    return;
}


                console.log(
                    "Providing authorization code to Genesys."
                );


                // Return the authorization information to Genesys.
                //
                // authCode is the authorization code returned
                // by Auth0.
                //
                // redirectUri must match the Auth0 request.
                //
                // nonce must match the original OIDC request.
                //
                // codeVerifier is required because we are
                // using PKCE.
                const authData = {
                    authCode:
                        authCode,

                    redirectUri:
                        redirectUri,

                    nonce:
                        nonce
                };


                // Include the PKCE verifier when available.
                if (codeVerifier) {

                    authData.codeVerifier =
                        codeVerifier;
                }


                // Give the authentication data to Genesys.
                event.resolve(
                    authData
                );
            }
        );


        // ----------------------------------------------------
        // Genesys requests re-authentication.
        // ----------------------------------------------------

        AuthProvider.registerCommand(
            "reAuthenticate",
            (event) => {

                console.log(
                    "Genesys requested re-authentication."
                );


                // Start a new Auth0 login.
                startGenesysAuthentication();


                // Auth0 will redirect the browser.
                event.resolve();
            }
        );


        // ----------------------------------------------------
        // Authentication ready event.
        // ----------------------------------------------------

        AuthProvider.subscribe(
            "Auth.ready",
            () => {

                console.log(
                    "Genesys AuthProvider authentication is ready."
                );
            }
        );


        // ----------------------------------------------------
        // Authentication successful event.
        // ----------------------------------------------------

        AuthProvider.subscribe(
        "Auth.authenticated",
        (event) => {

            // Confirm that Genesys authentication completed successfully.
            console.log(
                "Genesys authentication succeeded."
            );

            // Display the authentication event so we can inspect
            // what identity information Genesys provides to the browser.
            console.log(
                "Genesys authentication event:",
                event
            );

        // Mark Genesys authentication as available.
        genesysAuthenticated = true;
    }
);


        // ----------------------------------------------------
        // Authentication error event.
        // ----------------------------------------------------

        AuthProvider.subscribe(
            "Auth.error",
            (error) => {

                console.error(
                    "Genesys authentication error:",
                    error
                );
            }
        );


        // ----------------------------------------------------
        // Authentication failure event.
        // ----------------------------------------------------

        AuthProvider.subscribe(
            "Auth.authError",
            (error) => {

                console.error(
                    "Genesys authentication failed:",
                    error
                );
            }
        );


        // Tell Genesys that our AuthProvider is ready.
        AuthProvider.ready();


        console.log(
            "Genesys AuthProvider is ready."
        );
    }
);


// ============================================================
// Genesys Messenger — Open chat
// ============================================================

chatButton.addEventListener(
    "click",
    () => {

        // Record that the user explicitly requested a conversation.
        // This allows Genesys authentication to start when needed.
        genesysChatRequested = true;

        console.log(
            "Chat button clicked."
        );

        if (genesysAuthenticated) {

            console.log(
                "Genesys authentication data is available."
            );

        } else {

            console.log(
                "No Genesys authentication data found."
            );
        }


        // Open the Messenger widget.
        window.Genesys(
            "command",
            "Messenger.open"
        );
    }
);


// ============================================================
// Normal Auth0 login button
// ============================================================

if (auth0LoginButton) {

    auth0LoginButton.addEventListener(
        "click",
        loginWithAuth0
    );
}


// ============================================================
// Temporary console helper
// ============================================================

// Allows us to manually start the Genesys Auth0 flow.
//
// Example:
// startGenesysAuthentication()
window.startGenesysAuthentication =
    startGenesysAuthentication;


// ============================================================
// Application startup
// ============================================================

window.addEventListener(
    "load",
    async () => {

        // Initialize only our normal Auth0 SPA here.
        //
        // The Genesys callback was already processed
        // synchronously before AuthProvider initialization.
        await initializeAuth0();
    }
);