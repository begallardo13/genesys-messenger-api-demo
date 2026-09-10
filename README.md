Genesys Messenger API Demo
Phase 1–5 Portfolio Documentation
Project Status: Phase 5 — Authentication & Authorization completed
1. Project Overview
A proof-of-concept web application demonstrating how a website can authenticate a customer, retrieve customer
information from a protected REST API, and pass authenticated customer context into Genesys Cloud Web Messenger.
The project combines frontend JavaScript, Node.js/Express, JWT authentication, API authorization, Genesys Cloud Web
Messenger, and Architect participant data.
2. Project Status
Phase Description Status
Phase 1 Genesys Web Messenger POC Completed
Phase 2 Customer context / participant attributes Completed
Phase 3 Architect personalization Completed
Phase 4 REST API integration Completed
Phase 5 Authentication & authorization Completed
3. Architecture
Website
|
+----------+----------+
| |
Anonymous Login
| |
| Authentication API
| |
| JWT
| |
| Protected API
| |
| Customer Data
| |
+----------+----------+
|
v
Genesys Messenger
|
v
Participant Data
|
v
Architect
|
v
Personalized Response
4. Authenticated Flow
Genesys Messenger API Demo — Portfolio Documentation Page 1
Customer
|
| Customer ID + Password
v
Website
|
| POST /api/auth/login
v
Authentication API
|
| JWT
v
Website
|
| Authorization: Bearer <JWT>
v
Protected Customer API
|
| Customer Data
v
Website
|
| Database.set
v
Genesys Web Messenger
|
v
Architect
|
v
Personalized Customer Experience
5. Anonymous Flow
Visitor
|
v
Website
|
v
| No login
Chat with us
|
v
Genesys Web Messenger
|
v
Architect
Anonymous visitors can still start a conversation, but no customer-specific attributes are sent to Genesys.
6. Project Structure
genesys-messenger-api-demo/
■■■ node_modules/
■■■ public/
■ ■■■ index.html
■ ■■■ app.js
■ ■■■ style.css
■■■ src/
■ ■■■ server.js
■■■ package.json
■■■ package-lock.json
■■■ README.md
7. Technologies
Genesys Messenger API Demo — Portfolio Documentation Page 2
Node.js • Express.js • JSON Web Tokens (JWT) • JavaScript • HTML • CSS • REST API • Genesys Cloud Web
Messenger • Genesys Cloud Architect • curl • Browser Developer Tools
8. Running the Application
node src/server.js
Server:
http://localhost:3000
Website:
http://localhost:3000
9. REST API
Health Check
GET /health
curl http://localhost:3000/health
Response:
{"status":"ok"}
Customer API
Protected endpoint: GET /api/customers/:customerId. A valid JWT must be supplied using the standard HTTP
Authorization header.
Authorization: Bearer <JWT>
10. Customer Data
The application currently uses an in-memory customer array for demonstration purposes. This can later be replaced with
a real database or external customer system.
[
{
"customerId": "CUS-10001",
"name": "Bien Gallardo",
"email": "bien@example.com",
"accountType": "Premium"
},
{
"customerId": "CUS-10002",
"name": "Jane Doe",
"email": "jane@example.com",
"accountType": "Standard"
}
]
11. Phase 5 — Authentication
Phase 5 introduced authentication using JSON Web Tokens. Customer ID and password are sent to the login endpoint;
valid credentials result in a signed JWT.
Login API
POST /api/auth/login
Request:
{
"customerId": "CUS-10001",
"password": "password123"
Genesys Messenger API Demo — Portfolio Documentation Page 3
}
Successful response:
{
"message": "Login successful",
"token": "<JWT>"
}
12. JWT Authentication
The customer API uses the standard Bearer token format. The server extracts the token, verifies its signature and
expiration, and places the authenticated user on the request object.
Authorization: Bearer <JWT>
Request
|
v
Authorization Header
|
v
Extract JWT
|
v
Verify JWT
|
+---- Invalid ----> 403
|
+---- Valid ------> Continue
13. Authentication Middleware
function authenticateToken(req, res, next) {
const authHeader = req.headers["authorization"];
const token = authHeader && authHeader.split(" ")[1];
if (!token) {
return res.status(401).json({
message: "Authentication token required"
});
}
jwt.verify(token, JWT_SECRET, (error, user) => {
if (error) {
return res.status(403).json({
message: "Invalid or expired token"
});
}
req.user = user;
next();
});
}
14. Phase 5 — Authorization
Authentication answers Who are you? Authorization answers What are you allowed to access? The project prevents
one customer from accessing another customer's information.
JWT identity: CUS-10001
Requested resource: /api/customers/CUS-10002
|
v
403
if (req.user.customerId !== customerId) {
return res.status(403).json({
message: "You are not authorized to access this customer"
Genesys Messenger API Demo — Portfolio Documentation Page 4
});
}
15. Security Testing
Test Expected Result
Incorrect password 401 PASS
No JWT 401 PASS
Invalid JWT 403 PASS
Valid JWT + own customer Customer data PASS
Valid JWT + another customer 403 PASS
16. Frontend Authentication
The frontend stores the JWT in JavaScript memory. After successful login, it uses the token to call the protected
customer API. Only after that protected request succeeds is the returned customer object stored as loggedInCustomer.
let authToken = null;
authToken = loginData.token;
GET /api/customers/:customerId
Authorization: Bearer <JWT>
loggedInCustomer = customer;
17. Genesys Cloud Integration
The application uses Genesys Cloud Web Messenger and a custom Chat with us button. The custom launcher opens
Messenger with Messenger.open.
window.Genesys("command", "Messenger.open");
18. Sending Customer Context to Genesys
For authenticated customers, the website uses Database.set to send customer attributes. The values come from the
authenticated/protected API response rather than a hardcoded customer object.
window.Genesys("command", "Database.set", {
messaging: {
customAttributes: {
customerId: loggedInCustomer.customerId,
customerName: loggedInCustomer.name,
email: loggedInCustomer.email,
accountType: loggedInCustomer.accountType
}
}
});
19. Conditional Customer Context
if (loggedInCustomer) {
// Send customer attributes to Genesys.
} else {
// Open Messenger anonymously.
}
Genesys Messenger API Demo — Portfolio Documentation Page 5
window.Genesys("command", "Messenger.open");
20. Genesys Participant Attributes
customerId CUS-10001
customerName Bien Gallardo
email bien@example.com
accountType Premium
21. Architect Integration
Genesys Architect retrieves participant attributes using Get Participant Data.
Participant Attribute Architect Variable
customerId Flow.CustomerID
customerName Flow.CustomerName
email Flow.CustomerEmail
accountType Flow.AccountType
22. Architect Personalization
The Architect flow evaluates the customer's account type. For Premium customers, it returns a personalized response.
Flow.AccountType == "Premium"
Response:
Welcome back, Bien Gallardo! You're a Premium customer.
How can we help you today?
23. End-to-End Demonstration
1. Customer opens website
2. Enters Customer ID + Password
3. Website calls Authentication API
4. API validates credentials
5. API generates JWT
6. Website calls protected Customer API
7. Customer API validates JWT
8. Customer API validates authorization
9. Customer data returned
10. Website stores customer context
11. Customer clicks "Chat with us"
12. Website sends attributes using Database.set
13. Genesys Messenger opens
14. Architect retrieves participant data
15. Architect provides personalized response
24. Anonymous Demonstration
1. Visitor opens website
2. Visitor does not log in
3. Visitor clicks "Chat with us"
4. Messenger opens
5. No customer attributes are sent
6. Visitor can still chat with an agent
25. Lessons Learned
Genesys Messenger API Demo — Portfolio Documentation Page 6
Authentication vs Authorization: Authentication verifies identity; authorization verifies permissions.
Bearer Tokens: The standard format is Authorization: Bearer <JWT>.
Frontend Authentication: A customer ID alone does not mean the user is authenticated. The user must successfully
authenticate and obtain a token before protected customer data is retrieved.
API Security: A protected API should validate token presence, validity, expiration, and authorization for the requested
resource.
26. Current Limitations
Passwords: The demo uses password123 for learning purposes. Production systems should use secure password
hashing or an external identity provider.
JWT Secret: The current secret is local and hardcoded for the demo. Production systems should use environment
variables or secure secret management.
Customer Database: Customer data is stored in memory and should be replaced with a real database or external
customer platform.
JWT Storage: The JWT is kept in JavaScript memory for the demo. Production architecture should carefully address
token storage, expiration, refresh, and theft protection.
Authentication Provider: Authentication is simulated. A production implementation should use an identity provider and
OAuth 2.0 / OpenID Connect.
HTTPS: Production applications must use HTTPS to protect credentials and tokens in transit.
27. Future Improvements
• Phase 6 — Production-style authentication: OAuth 2.0, OpenID Connect, identity providers, access/refresh tokens, and
token expiration.
• Phase 7 — Genesys Authenticated Web Messaging: integrate the website identity provider with an authenticated
Genesys messaging journey.
• Phase 8 — Real customer backend: replace the in-memory customer array with a database, CRM, or customer
platform.
• Phase 9 — Production deployment: environment variables, HTTPS, cloud deployment, logging, rate limiting,
monitoring, automated tests, and CI/CD.
28. Portfolio Value
This project demonstrates practical knowledge of REST API design, Node.js, Express.js, HTTP, JSON, JWT
authentication, authorization, middleware, frontend API integration, asynchronous JavaScript, Genesys Cloud Web
Messenger, participant data, Architect, and external-system-to-Genesys integration.
29. Final Architecture
CUSTOMER
|
v
WEB APPLICATION
|
+------------+------------+
| |
Anonymous Authenticated
Genesys Messenger API Demo — Portfolio Documentation Page 7
| |
| Login + Password
| |
| v
| Authentication API
| |
| JWT
| |
| v
| Protected API
| |
| Authorization
| |
| Customer Data
| |
+------------+------------+
|
v
GENESYS MESSENGER
|
Participant Data
|
v
ARCHITECT
|
v
Personalized Experience
30. Project Milestone
Phase 5 completed successfully. The POC now demonstrates a complete authenticated integration between a
website, a protected REST API, and Genesys Cloud Web Messenger.
Key architectural principle: Authenticate the customer first, retrieve authorized customer data through a protected API,
and only then pass the customer context into Genesys Cloud.
Genesys Messenger API Demo — Portfolio Documentation Page 8