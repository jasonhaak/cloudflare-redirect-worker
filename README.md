# cloudflare-redirect-worker
A Cloudflare Worker for secure, configurable HTTP redirects based on subdomain.
This worker is designed for scenarios where you need to route requests for specific subdomains (such as `routing.example.com`) to external URLs, while enforcing security and access controls.
It is ideal for protecting sensitive redirect endpoints with Basic Auth and rate limiting, ensuring only requests to allowed hostnames are processed.

---

## Features
- **HTTPS Enforcement**: All requests are redirected to HTTPS if received over HTTP.
- **Subdomain-based Redirects**: Requests to specific subdomains are redirected to URLs configured via environment variables.
- **Configurable Targets**: Redirect destinations are set using environment variables for flexibility (`LINK_<SUBDOMAIN>`).
- **Basic Authentication for Protected Subdomains**: Defined subdomains require Basic Auth credentials, checked against environment variables (`USER_<SUBDOMAIN>`, `PASS_<SUBDOMAIN>`).
- **In-memory Rate Limiting**: Failed authentication attempts are tracked per client and subdomain in-memory, with limits enforced to prevent brute-force attacks.
- **Strict Security Headers**: All responses include headers to prevent common web vulnerabilities.
- **Allowed Host Suffixes**: Only requests to hostnames ending with configured suffixes are processed; others receive a 404.
- **Protected Subdomains Configurable**: List of protected subdomains is set via the `PROTECTED_SUBDOMAINS` environment variable.

## Installation
1. **Install Wrangler**
Wrangler is the official CLI for Cloudflare Workers. Install it globally using npm:
```
npm install -g wrangler
```

2. **Clone the Repository**
```
git clone https://github.com/jasonhaak/cloudflare-redirect-worker.git
cd cloudflare-redirect-worker
```

3. **Configure Environment Variables**
You can set environment variables in your `wrangler.toml` file or via the Cloudflare.

4. See the Configuration section below for details and examples.

5. **Deploy the Worker**
```
wrangler deploy
```

---

## Configuration
> **Note:** Never publish your environment variables publicly, as it may expose sensitive secrets such as authentication credentials and redirect targets.

You must configure the worker using environment variables. This can be done in your `wrangler.toml` file or through the Cloudflare.

### Variable Descriptions
- `ALLOWED_HOST_SUFFIXES`
  - Comma-separated list of allowed host suffixes
  - Only requests to hostnames ending with these suffixes will be processed
- `PROTECTED_SUBDOMAINS`
  - Comma-separated list of subdomains that require authentication
- `LINK_<SUBDOMAIN>`
  - Redirect target URL for each subdomain.
  - Example: `LINK_CV` for `cv.example.com`
- `USER_<SUBDOMAIN>`, `PASS_<SUBDOMAIN>`
  - Credentials for each protected subdomain.
  - Example: `USER_NACHLASS`, `PASS_NACHLASS` for `nachlass.example.com`
- `FALLBACK_USER`, `FALLBACK_PASS`
  - Optional fallback credentials if specific subdomain credentials are not set

### Example Environment Variables
```toml
ALLOWED_HOST_SUFFIXES = ".example.com,.example.org"
PROTECTED_SUBDOMAINS = "admin,secure"
LINK_PUBLIC = "https://www.public.com/"
LINK_ADMIN = "https://admin.com/"
LINK_SECURE = "https://secure.com/"
USER_ADMIN = "admin_user"
PASS_ADMIN = "admin_password"
USER_SECURE = "secure_user"
PASS_SECURE = "secure_password"
FALLBACK_USER = "fallback_user"
FALLBACK_PASS = "fallback_password"
```

### How It Works
- When a request comes in, the worker checks if the hostname matches any suffix in `ALLOWED_HOST_SUFFIXES`
- It extracts the subdomain and looks for a corresponding `LINK_<SUBDOMAIN>` variable to determine the redirect target
- If the subdomain is listed in `PROTECTED_SUBDOMAINS`, the worker checks for credentials in `USER_<SUBDOMAIN>` and `PASS_<SUBDOMAIN>`, falling back to `FALLBACK_USER` and `FALLBACK_PASS` if not set
- If authentication fails or rate limits are exceeded, the worker responds with an error

## Usage
Deploy to Cloudflare Workers:
```
wrangler deploy
```

---

## Testing
Run all unit tests with:
```
npm test
```
Tests cover authentication, host parsing, rate limiting, security headers, and utility functions.

---

## Author & Licence
This code was written by Jason Haak and is licensed under the MIT licence.