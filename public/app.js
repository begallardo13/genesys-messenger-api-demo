// ============================================================
// Auth0 SPA configuration
// ============================================================

// Auth0 application used by our normal website login.
const auth0Config = {
    domain: "begallardo.us.auth0.com",

    // Public SPA client ID.
    clientId: "18x4fdXSQJWKAGiGuQ78E2E5miScZ1EG",

    // Persist the Auth0 SPA session across full-page redirects.
    // This is needed because Genesys authentication redirects
    // the browser to /genesys-callback and back.
    cacheLocation: "localstorage",

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

// Prevent multiple conversation-start requests at the same time.
let conversationStarting = false;

// Indicates that a Genesys Auth0 authorization code
// is available for Messenger.
let genesysAuthenticated =
    sessionStorage.getItem(
        "genesys_auth_code"
    ) !== null;

// Stores the Genesys AuthProvider instance.
// We use this to start authentication only when the user requests a conversation.
let genesysAuthProvider = null;


// ============================================================
// DOM references
// ============================================================

const customerInfo =
    document.getElementById("customerInfo");

const auth0LoginButton =
    document.getElementById("auth0LoginButton");

const chatButton =
    document.getElementById("chatButton");

// Get the Messenger card so we can show it
// only after the customer signs in with Auth0.
const messengerCard =
    document.getElementById("messengerCard");

// Hide the Messenger card until the customer
// has successfully signed in with Auth0.
messengerCard.style.display = "none";

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


    // Stop here only when the user is not authenticated.
    // An existing Auth0 session should also restore the
    // customer profile after a page refresh or Genesys redirect.
    if (!isAuthenticated) {

    // Display a clear logged-out state in the profile card.
    customerInfo.innerHTML = `
        <h3>Not signed in</h3>
        <p>Sign in to retrieve your customer profile.</p>
    `;

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
        loggedInCustomer = customer;

        // Reveal the Messenger card after the customer
        // has successfully authenticated with Auth0
        // and their customer profile was retrieved.
        messengerCard.style.display = "block";

        // Hide the login button because the customer
        // is already authenticated.
        auth0LoginButton.style.display = "none";


        // Display the authenticated customer profile.
        // The information combines the Auth0 identity
        // with the customer record returned by our API.
        customerInfo.innerHTML = `
            <h3>✓ Authenticated</h3>
            <p><strong>Name:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Auth0 ID:</strong> ${user.sub}</p>
        `;


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
// GENESYS AUTHENTICATED WEB MESSAGING - IMPLICIT AUTHENTICATION
// ============================================================

// Store the Genesys Auth0 client ID separately from our normal SPA client.
const GENESYS_AUTH0_CLIENT_ID =
    "zH9WQuQVnBpUJwa3ccmAFmmo0ljuHJmO";

// Use a dedicated callback URL for the Genesys authentication flow.
const GENESYS_CALLBACK_URI =
    window.location.origin + "/genesys-callback";

// Store the temporary OAuth state in sessionStorage.
// sessionStorage survives the redirect but is cleared when the tab closes.
const GENESYS_STATE_KEY = "genesys_auth_state";

// Store the temporary OAuth nonce in sessionStorage.
const GENESYS_NONCE_KEY = "genesys_auth_nonce";

// Store the ID token temporarily after Auth0 redirects back.
const GENESYS_ID_TOKEN_KEY = "genesys_id_token";

// Track whether Genesys authentication has completed.
// The variable is initialized with the persisted session state above.

// ------------------------------------------------------------
// Helper: generate a secure random OAuth value.
// ------------------------------------------------------------

function generateGenesysRandomValue() {
    // Create 32 random bytes using the browser's cryptographic API.
    const randomBytes = new Uint8Array(32);

    // Fill the array with cryptographically secure random values.
    window.crypto.getRandomValues(randomBytes);

    // Convert the bytes into a URL-safe Base64-like string.
    return Array.from(randomBytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

// ------------------------------------------------------------
// Helper: decode the JWT payload without logging the token.
// ------------------------------------------------------------

function decodeGenesysJwtPayload(token) {
    // Split the JWT into header, payload, and signature.
    const parts = token.split(".");

    // Reject anything that is not a normal JWT.
    if (parts.length !== 3) {
        throw new Error("Genesys ID token is not a valid JWT.");
    }

    // Decode the Base64URL payload section.
    const base64 = parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    // Add padding required by atob().
    const padded = base64.padEnd(
        base64.length + ((4 - (base64.length % 4)) % 4),
        "="
    );

    // Convert the decoded payload into a JavaScript object.
    return JSON.parse(atob(padded));
}

// ------------------------------------------------------------
// Prepare the Genesys Auth0 callback.
// ------------------------------------------------------------

function prepareGenesysCallback() {
    // Only process the callback when we are on the Genesys callback URL.
    if (window.location.pathname !== "/genesys-callback") {
        return;
    }

    // Read the URL fragment returned by Auth0.
    const hashParams = new URLSearchParams(
        window.location.hash.substring(1)
    );

    // Check whether Auth0 returned an OAuth error.
    const authError = hashParams.get("error");

    // Stop processing when Auth0 reports an error.
    if (authError) {
        console.error(
            "Genesys Auth0 authentication failed:",
            authError,
            hashParams.get("error_description")
        );

        // Remove the OAuth fragment from the browser URL.
        window.history.replaceState(
            {},
            document.title,
            "/"
        );

        return;
    }

    // Retrieve the returned ID token from the URL fragment.
    const idToken = hashParams.get("id_token");

    // Retrieve the OAuth state returned by Auth0.
    const returnedState = hashParams.get("state");

    // Retrieve the state that our application originally generated.
    const expectedState =
        sessionStorage.getItem(GENESYS_STATE_KEY);

    // Make sure Auth0 returned an ID token.
    if (!idToken) {
        console.log(
            "Genesys Auth0 callback did not contain an ID token."
        );

        return;
    }

    // Validate the OAuth state to protect against CSRF.
    if (!returnedState || returnedState !== expectedState) {
        console.error(
            "Genesys Auth0 callback state validation failed."
        );

        return;
    }

    // Retrieve the nonce that our application originally generated.
    const expectedNonce =
        sessionStorage.getItem(GENESYS_NONCE_KEY);

    try {
        // Decode the ID token payload so we can validate its nonce.
        const tokenPayload =
            decodeGenesysJwtPayload(idToken);

        // Make sure the ID token contains the expected nonce.
        if (
            expectedNonce &&
            tokenPayload.nonce !== expectedNonce
        ) {
            console.error(
                "Genesys Auth0 ID token nonce validation failed."
            );

            return;
        }

        // Store the validated ID token for AuthProvider.getAuthCode().
        sessionStorage.setItem(
            GENESYS_ID_TOKEN_KEY,
            idToken
        );

        // Mark Genesys authentication as prepared.
        genesysAuthenticated = true;

        console.log(
            "Genesys Auth0 ID token prepared."
        );
    } catch (error) {
        // Log token parsing/validation failures without exposing the token.
        console.error(
            "Unable to process Genesys Auth0 ID token:",
            error
        );

        return;
    }

    // Remove the OAuth fragment from the visible browser URL.
    window.history.replaceState(
        {},
        document.title,
        "/genesys-callback"
    );
}

// ------------------------------------------------------------
// Start silent Genesys Auth0 authentication.
// ------------------------------------------------------------

function startGenesysAuthentication() {
    // Generate a unique state value for this authentication request.
    const state = generateGenesysRandomValue();

    // Generate a unique nonce for the returned ID token.
    const nonce = generateGenesysRandomValue();

    // Save the state so the callback can validate it.
    sessionStorage.setItem(
        GENESYS_STATE_KEY,
        state
    );

    // Save the nonce so the callback can validate the ID token.
    sessionStorage.setItem(
        GENESYS_NONCE_KEY,
        nonce
    );

    // Build the Auth0 authorization URL for the Genesys application.
    const authorizationUrl =
        "https://begallardo.us.auth0.com/authorize" +
        "?client_id=" +
        encodeURIComponent(GENESYS_AUTH0_CLIENT_ID) +
        "&response_type=id_token" +
        "&response_mode=fragment" +
        "&redirect_uri=" +
        encodeURIComponent(GENESYS_CALLBACK_URI) +
        "&scope=" +
        encodeURIComponent("openid email profile") +
        "&state=" +
        encodeURIComponent(state) +
        "&nonce=" +
        encodeURIComponent(nonce);

    // Redirect to Auth0 and request silent authentication.
    window.location.assign(authorizationUrl);
}

// ------------------------------------------------------------
// Register the Genesys AuthProvider.
// ------------------------------------------------------------

function initializeGenesysAuthProvider(AuthProvider) {
    // Receive and store the Genesys AuthProvider plugin instance.
    // The chat button uses this reference to start authentication.
    genesysAuthProvider = AuthProvider;

    // Register the command Genesys uses to request authentication.
    AuthProvider.registerCommand(
        "getAuthCode",
        (event) => {
            // Log that Genesys requested authentication information.
            console.log(
                "Genesys requested authentication credentials."
            );

            // Retrieve the ID token prepared by the Auth0 callback.
            const idToken =
                sessionStorage.getItem(
                    GENESYS_ID_TOKEN_KEY
                );

            // Check whether Genesys is requesting a forced update.
            if (event.data && event.data.forceUpdate) {
                // Start a fresh silent authentication attempt.
                startGenesysAuthentication();

                // Do not provide the previous token.
                event.resolve({});

                return;
            }

            // If an ID token is not available yet, start the Auth0
            // authentication flow instead of returning empty credentials.
            if (!idToken) {
                // Remember that the user requested a conversation.
                // The callback will use this flag to open Messenger
                // after Genesys authentication succeeds.
                    sessionStorage.setItem(
                    "genesys_pending_conversation",
                    "true"
    );

    // Start the Genesys-specific Auth0 implicit authentication.
    startGenesysAuthentication();

    // Do not provide credentials until Auth0 returns
    // with the ID token.
    event.resolve({});

    return;
}

            // Build the implicit authentication payload expected by Genesys.
            const authData = {
                // Genesys expects the property to be named "idToken".
                idToken: idToken,

                // Tell Genesys which callback URL belongs to this token.
                redirectUri: GENESYS_CALLBACK_URI
            };

            // Retrieve the nonce used during the Auth0 request.
            const nonce =
                sessionStorage.getItem(
                    GENESYS_NONCE_KEY
                );

            // Include the nonce when one is available.
            if (nonce) {
                authData.nonce = nonce;
            }

            // Give the ID token to Genesys' implicit authentication flow.
            event.resolve(authData);

            // Log only that the credential was supplied.
            console.log(
                "Providing Genesys ID token to Genesys."
            );
        }
    );

    // Register the command Genesys uses when authentication must restart.
    AuthProvider.registerCommand(
        "reAuthenticate",
        () => {
            // Start a new silent Auth0 authentication request.
            startGenesysAuthentication();
        }
    );

    // Log when the AuthProvider becomes ready.
    AuthProvider.subscribe(
        "Auth.ready",
        () => {
            console.log(
                "Genesys AuthProvider is ready."
            );
        }
    );

    // Listen for successful Genesys authentication.
    AuthProvider.subscribe(
        "Auth.authenticated",
        () => {
            // Mark Genesys as authenticated.
            genesysAuthenticated = true;

            // Log the successful authentication event.
            console.log(
                "Genesys authentication succeeded."
            );

            // Check whether the user was waiting to open Messenger.
            const pendingConversation =
                sessionStorage.getItem(
                    "genesys_pending_conversation"
                );

            // Open Messenger when a conversation was requested before
            // authentication completed.
            if (pendingConversation === "true") {
                // Remove the pending flag before opening Messenger.
                sessionStorage.removeItem(
                    "genesys_pending_conversation"
                );

                // Give the Messenger plugin a moment to initialize.
                setTimeout(() => {
                    // Open the Genesys Messenger widget.
                    window.Genesys(
                        "command",
                        "Messenger.open"
                    );
                }, 500);
            }
        }
    );

    // Listen for Genesys authentication errors.
    AuthProvider.subscribe(
        "Auth.error",
        (event) => {
            // Log the authentication error without exposing tokens.
            console.error(
                "Genesys authentication error:",
                event
            );
        }
    );

    // Listen for Genesys authentication errors using the authError event.
    AuthProvider.subscribe(
        "Auth.authError",
        (event) => {
            // Log the authentication error without exposing tokens.
            console.error(
                "Genesys authentication error:",
                event
            );
        }
    );

    // Tell Genesys the AuthProvider is ready only after the callback
    // has prepared the ID token.
    if (genesysAuthenticated) {
        // Signal that the authentication provider can be used.
        AuthProvider.ready();

        // Log that the provider is ready for authentication.
        console.log(
            "Genesys AuthProvider authentication is ready."
        );
    } else {
        // Wait for the user to request Messenger authentication.
        console.log(
            "Genesys AuthProvider initialized. Waiting for user action."
        );
    }
}

// ------------------------------------------------------------
// Process the callback before initializing the AuthProvider.
// ------------------------------------------------------------

// Prepare the Genesys Auth0 callback before registering the plugin.
prepareGenesysCallback();

// Register the Genesys AuthProvider plugin.
window.Genesys(
    "registerPlugin",
    "AuthProvider",
    (AuthProvider) => {
        // Initialize our authentication commands using
        // the AuthProvider instance supplied by Genesys.
        initializeGenesysAuthProvider(AuthProvider);
    }
);


// ============================================================
// Genesys Messenger — Open chat
// ============================================================

chatButton.addEventListener(
    "click",
    () => {

        // Prevent duplicate clicks while a conversation
        // request is already being processed.
        if (conversationStarting) {
            return;
        }

        // Mark the conversation request as active.
        conversationStarting = true;

        // Confirm that the user explicitly requested
        // a Genesys conversation.
        console.log(
            "Chat button clicked."
        );


        // Remember that the user requested a conversation.
        // This value survives the Auth0 redirect.
        sessionStorage.setItem(
            "genesys_pending_conversation",
            "true"
        );


        // Disable the button so the user cannot
        // accidentally start another request.
        chatButton.disabled = true;

        // Tell the user that the conversation is being started.
        chatButton.textContent = "Connecting...";


        // If Genesys authentication is already available,
        // give Genesys time to finish loading Messenger
        // before opening the widget.
        if (genesysAuthenticated) {

            console.log(
                "Genesys authentication data is available."
            );


            // Allow the Genesys Messenger plugin to finish
            // initializing before issuing Messenger.open.
            setTimeout(
                () => {

                    console.log(
                        "Opening Genesys Messenger."
                    );


                    window.Genesys(
                        "command",
                        "Messenger.open"
                    );


                    // Re-enable the button after Messenger
                    // has been requested to open.
                    conversationStarting = false;
                    chatButton.disabled = false;

                    // Restore the original button label.
                    chatButton.textContent = "Start Conversation";

                },
                500
            );


            return;
        }


        console.log(
            "Genesys authentication is not available."
        );


        // AuthProvider must exist before we can activate it.
        if (genesysAuthProvider) {

            console.log(
                "Starting Genesys authentication."
            );


            // Start the Genesys authentication lifecycle.
            genesysAuthProvider.ready();


            console.log(
                "Genesys AuthProvider is ready."
            );

        } else {

            console.error(
                "Genesys AuthProvider is not available."
            );

            // Reset the state because authentication
            // could not be started.
            conversationStarting = false;
            chatButton.disabled = false;

            // Restore the original button label.
            chatButton.textContent = "Start Conversation";
        }
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