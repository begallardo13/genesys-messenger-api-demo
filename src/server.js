// Load environment variables from .env.
require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
const path = require("path");

// Load jose dynamically because this project currently uses CommonJS.
const josePromise = import("jose");

const app = express();
// Use Render's assigned port in production.
// Fall back to port 3000 when running locally.
const PORT = process.env.PORT || 3000;

// ============================================================
// Environment configuration
// ============================================================

// Secret used by the original Phase 5 demo JWT implementation.
const JWT_SECRET = process.env.JWT_SECRET;

// Auth0 tenant configuration used by the production-style flow.
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;
const AUTH0_ISSUER = process.env.AUTH0_ISSUER;

// Stop the application if the required configuration is missing.
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
}

if (!AUTH0_DOMAIN) {
    throw new Error("AUTH0_DOMAIN is not configured.");
}

if (!AUTH0_AUDIENCE) {
    throw new Error("AUTH0_AUDIENCE is not configured.");
}

if (!AUTH0_ISSUER) {
    throw new Error("AUTH0_ISSUER is not configured.");
}

// Auth0 publishes its public signing keys through this endpoint.
const auth0JwksUrl = new URL(
    `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
);

// Reuse the JWKS client between requests.
let auth0JWKS = null;

// ============================================================
// Middleware
// ============================================================

// Parse incoming JSON request bodies.
app.use(express.json());

// Serve files from the public directory.
app.use(express.static("public"));

// ============================================================
// Demo customer data
// ============================================================

const customers = [
    {
        customerId: "CUS-10001",
        name: "Bien Gallardo",
        email: "bien@example.com",
        accountType: "Premium"
    },
    {
        customerId: "CUS-10002",
        name: "Jane Doe",
        email: "jane@example.com",
        accountType: "Standard"
    }
];

// ============================================================
// Auth0 user → application customer mapping
// ============================================================

// This is a simple demo mapping.
// In a real application, this relationship would normally
// live in a database or be represented by a trusted claim.
const auth0CustomerMapping = {
    "auth0|6a9e6ac72c8bbd2f93e5f7b0": "CUS-10001"
};

// ============================================================
// Phase 5 — Custom JWT authentication
// ============================================================

// Middleware for the original simulated JWT authentication flow.
function authenticateToken(req, res, next) {

    // Read the Authorization header.
    const authHeader = req.headers["authorization"];

    // Extract the token after "Bearer ".
    const token = authHeader && authHeader.split(" ")[1];

    // Reject requests without a token.
    if (!token) {
        return res.status(401).json({
            message: "Authentication token required"
        });
    }

    // Verify the token using our demo JWT secret.
    jwt.verify(token, JWT_SECRET, (error, user) => {

        if (error) {

            // Return a specific response for expired tokens.
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({
                    message: "Token has expired"
                });
            }

            // Reject any other invalid token.
            return res.status(403).json({
                message: "Invalid token"
            });
        }

        // Store the verified custom JWT claims.
        req.user = user;

        // Continue to the protected endpoint.
        next();
    });
}

// ============================================================
// Phase 6 — Auth0 access token validation
// ============================================================

// Validate an access token issued by Auth0.
async function authenticateAuth0Token(req, res, next) {

    // Read the Authorization header.
    const authHeader = req.headers["authorization"];

    // Extract the token after "Bearer ".
    const token = authHeader && authHeader.split(" ")[1];

    // Reject requests without an Auth0 access token.
    if (!token) {
        return res.status(401).json({
            message: "Auth0 access token required"
        });
    }

    try {

        // Wait for jose to finish loading.
        const {
            createRemoteJWKSet,
            jwtVerify
        } = await josePromise;

        // Create the JWKS client once and reuse it.
        if (!auth0JWKS) {
            auth0JWKS = createRemoteJWKSet(auth0JwksUrl);
        }

        // Verify the Auth0 JWT signature and claims.
        const { payload } = await jwtVerify(
            token,
            auth0JWKS,
            {
                // Our Auth0 API uses RS256 signing.
                algorithms: ["RS256"],

                // Verify that Auth0 issued this token.
                issuer: AUTH0_ISSUER,

                // Verify that this token was issued for our API.
                audience: AUTH0_AUDIENCE
            }
        );

        // Store the verified Auth0 claims on the request.
        req.auth = payload;

        // Read the permissions granted to this access token.
        // Auth0 places the scopes in the "scope" claim as a space-separated string.
        const scopes = payload.scope ? payload.scope.split(" ") : [];

        // Require the read:customer permission before allowing
        // access to customer information.
        if (!scopes.includes("read:customer")) {
            return res.status(403).json({
            message: "Insufficient permissions"
            });
        }   

        // Continue to the protected endpoint.
        next();

        } catch (error) {

        // Log the actual validation problem for debugging.
        console.error("Auth0 token validation failed:", error);

        // Do not expose internal validation details to the client.
        return res.status(401).json({
            message: "Invalid or expired Auth0 access token"
        });
    }
}

// ============================================================
// Health check
// ============================================================

app.get("/health", (req, res) => {

    // Simple endpoint used to confirm that the API is running.
    res.json({
        status: "ok"
    });
});

// ============================================================
// Phase 5 — Custom login
// ============================================================

app.post("/api/auth/login", (req, res) => {

    // Read credentials from the request body.
    const { customerId, password } = req.body;

    // Find the requested customer.
    const customer = customers.find(
        (item) => item.customerId === customerId
    );

    // Reject unknown customers.
    if (!customer) {
        return res.status(401).json({
            message: "Invalid customer ID or password"
        });
    }

    // Demo password used by the original Phase 5 exercise.
    if (password !== "password123") {
        return res.status(401).json({
            message: "Invalid customer ID or password"
        });
    }

    // Create a short-lived access token.
    const token = jwt.sign(
        {
            customerId: customer.customerId
        },
        JWT_SECRET,
        {
            expiresIn: "1h"
        }
    );

    // Create a longer-lived simulated refresh token.
    const refreshToken = jwt.sign(
        {
            customerId: customer.customerId
        },
        JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );

    // Return both tokens to the demo application.
    res.json({
        message: "Login successful",
        accessToken: token,
        refreshToken: refreshToken
    });
});

// ============================================================
// Phase 5 — Refresh token
// ============================================================

app.post("/api/auth/refresh", (req, res) => {

    // Read the refresh token from the request body.
    const { refreshToken } = req.body;

    // Reject requests without a refresh token.
    if (!refreshToken) {
        return res.status(401).json({
            message: "Refresh token required"
        });
    }

    // Verify the refresh token.
    jwt.verify(refreshToken, JWT_SECRET, (error, user) => {

        if (error) {
            return res.status(403).json({
                message: "Invalid or expired refresh token"
            });
        }

        // Create a new access token.
        const accessToken = jwt.sign(
            {
                customerId: user.customerId
            },
            JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        // Return the new access token.
        res.json({
            accessToken: accessToken
        });
    });
});

// ============================================================
// Auth0 callback
// ============================================================

// Serve the SPA when Auth0 redirects the browser to /callback.
app.get("/callback", (req, res) => {

    // Return the application's main HTML file.
    res.sendFile(
        path.join(__dirname, "..", "public", "index.html")
    );
});

// ============================================================
// Genesys Auth0 callback
// ============================================================

// Serve the application page when Auth0 redirects back
// after the Genesys Messenger authentication request.
app.get("/genesys-callback", (req, res) => {

    res.sendFile(
        path.join(__dirname, "..", "public", "index.html")
    );
});

// ============================================================
// Protected customer API
// ============================================================

// ============================================================
// Auth0 — Current authenticated customer
// ============================================================

// Return the customer associated with the authenticated Auth0 user.
app.get(
    "/api/me",

    // Require a valid Auth0 access token and read:customer scope.
    authenticateAuth0Token,

    (req, res) => {

        // Get the Auth0 user's unique subject identifier.
        const auth0Subject = req.auth.sub;

        // Look up which application customer belongs to
        // to the authenticated Auth0 user.
        const customerId =
            auth0CustomerMapping[auth0Subject];

        // Reject authenticated users that aren't linked
        // to a customer in our application.
        if (!customerId) {
            return res.status(403).json({
                message: "Authenticated user is not linked to a customer"
            });
        }

        // Find the customer's record.
        const customer = customers.find(
            (item) => item.customerId === customerId
        );

        // Return 404 if the mapped customer no longer exists.
        if (!customer) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        // Return the authenticated customer's information.
        res.json(customer);
    }
);

app.get(
    "/api/customers/:customerId",

    // Require a valid Auth0 access token.
    authenticateAuth0Token,

    (req, res) => {

        // Get the requested customer ID from the URL.
        const customerId = req.params.customerId;

        // Get the authenticated Auth0 user's subject.
        const auth0Subject = req.auth.sub;

        // Look up which application customer belongs to
        // to the authenticated Auth0 user.
        const authenticatedCustomerId =
            auth0CustomerMapping[auth0Subject];

        // Reject Auth0 users that aren't mapped to a customer.
        if (!authenticatedCustomerId) {
            return res.status(403).json({
                message: "Authenticated user is not linked to a customer"
            });
        }

        // Make sure the authenticated user can only access
        // their own customer record.
        if (authenticatedCustomerId !== customerId) {
            return res.status(403).json({
                message: "You are not authorized to access this customer"
            });
        }

        // Find the customer record.
        const customer = customers.find(
            (item) => item.customerId === customerId
        );

        // Return 404 if the customer doesn't exist.
        if (!customer) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        // Return the customer information.
        res.json(customer);
    }
);

// ============================================================
// Start server
// ============================================================

app.listen(PORT, () => {

    // Display the API address when the server starts.
    console.log(
        `Customer API running on http://localhost:${PORT}`
    );
});