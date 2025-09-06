# cloudflare-redirect-worker
A Cloudflare Worker for secure, configurable HTTP redirects by subdomain. It routes requests for specific subdomains (for example `foo.example.com`) to target URLs (for example `secure.com`) while providing optional Basic Auth, rate limiting and security headers.

## Features
- **HTTPS Enforcement**: Redirects HTTP requests to HTTPS
- **Subdomain-Based Redirects**: Map a subdomain (e.g. `foo.example.com`) to a redirect target URL configured via environment variables (`LINK_FOO`)
- **Protected Subdomains**: Require HTTP Basic Auth for configurable subdomains
- **In-Memory Rate Limiting**: Simple per-client + per-subdomain throttling of failed authentication attempts to mitigate brute-force attacks
- **Security Headers**: Responses include common security headers to reduce risk of common web attacks
- **Allowed Host Suffixes**: Only requests for configured host suffixes are processed; others return 404

## Quick Start
You will learn how to deploy the worker to Cloudflare, configure secrets and point DNS records for your subdomains to the worker route. Additionally, you will configure environment variables as secrets for routing and authentication.

This is the recommended method for non-technical users.

### 1. Prepare the Codebase
Cloudflare always requires a code source (repository or ZIP) to deploy a Worker. Choose one of the following:
- **Git (recommended)**: Fork this repository into your own GitHub/GitLab account
- **ZIP (manual upload)**: Download the code as a ZIP file and prepare it for upload

### 2. In the Cloudflare Dashboard
1. Navigate to your Worker -> **Settings -> Variables & Secrets**.
2. Add **all environment variables** as *secrets* (see below for descriptions and examples).

### 3. Deploy via the Dashboard
- **Git**: Connect your forked repository directly to your GitHub/GitLab account in the Cloudflare Dashboard. Cloudflare will build and deploy automatically.
- **ZIP**: Upload your prepared ZIP file using the Dashboard’s editor or deployment UI.

### 4. Update DNS
- Navigate to **Settings -> Routes** and add a domain or route for the Worker.
- Point DNS records for your subdomains to the Worker you configured.

## Environment Variables
> Important: When deploying this Worker via GitHub/GitLab integration, any variables set in the Cloudflare Dashboard as plain text or JSON will be **overwritten** during deployment. To avoid losing configuration, always declare variables as *secrets* in the Cloudflare Dashboard when using GitHub/GitLab as your deployment method.

### Variable Descriptions
- `ALLOWED_HOST_SUFFIXES`
    - Comma-separated list of allowed host suffixes
    - Only requests to hostnames ending with these suffixes will be processed
- `PROTECTED_SUBDOMAINS`
    - Comma-separated list of subdomains that require authentication
- `LINK_<SUBDOMAIN>`
    - Redirect target URL for each subdomain
    - Example: `LINK_FOO` for `foo.example.com`
    - **Multi-level subdomains**: Dots are replaced with underscores
    - Example: `api.v1.example.com` → `LINK_API_V1`
- `USER_<SUBDOMAIN>`, `PASS_<SUBDOMAIN>`
    - Credentials for each protected subdomain
    - Example: `USER_FOO`, `PASS_FOO` for `foo.example.com`
    - **Multi-level subdomains**: Dots are replaced with underscores
    - Example: `api.v1.example.com` → `USER_API_V1`, `PASS_API_V1`
- `FALLBACK_USER`, `FALLBACK_PASS`
    - Optional fallback credentials if specific subdomain credentials are not set

### Example Configuration
```toml
ALLOWED_HOST_SUFFIXES = ".example.com,.example.org"
PROTECTED_SUBDOMAINS = "foo,secure,api.v1"

LINK_PUBLIC = "https://www.public.com/"

LINK_FOO = "https://foo-website.com/"
USER_FOO = "foo_user"
PASS_FOO = "foo_password"

LINK_SECURE = "https://secure.com/"
USER_SECURE = "secure_user"
PASS_SECURE = "secure_password"

LINK_API_V1 = "https://api-v1.company.com/"
USER_API_V1 = "api_user"
PASS_API_V1 = "api_password"

FALLBACK_USER = "fallback_user"
FALLBACK_PASS = "fallback_password"
```

## How it Works
1. The worker checks the request hostname against `ALLOWED_HOST_SUFFIXES`.
2. It extracts the subdomain and resolves its redirect target from `LINK_<SUBDOMAIN>`.
3. If the subdomain is listed in `PROTECTED_SUBDOMAINS`, the worker enforces Basic Auth using configured credentials.
4. Failed auth attempts are rate-limited per client.
5. Valid requests are redirected with proper security headers.

## Installation & Development
For developers looking to customize or extend the worker, follow these steps.

1. **Clone the Repository**
    ```bash
    git clone https://github.com/jasonhaak/cloudflare-redirect-worker.git
    cd cloudflare-redirect-worker
    ```
2. **Install Dependencies**
    ```bash
    npm install
    ```
3. **Configure Environment Variables**:
    - You can set environment variables in your `wrangler.toml` file or via the Cloudflare dashboard.
4. **Deploy the Worker**
    ```bash
    wrangler deploy
    ```

## Testing
This project uses **Vitest** for unit tests. Run the suite locally:

```bash
npm test
```

The test suite covers authentication, host parsing, rate limiting, security headers and utility functions.

## Author & Licence
This code was written by Jason Haak and is licensed under the MIT licence.


