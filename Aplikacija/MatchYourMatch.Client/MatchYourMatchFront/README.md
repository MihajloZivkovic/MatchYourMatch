# MatchYourMatch frontend

## Local authentication URLs

Vite is fixed to `http://localhost:5173` and proxies `/api` to `http://localhost:5166`.

- Login: `http://localhost:5173/login`
- Register: `http://localhost:5173/register`
- Profile completion: `http://localhost:5173/complete-profile`
- Microsoft SPA callback: `http://localhost:5173/`
- Backend API: `http://localhost:5166`

Provider SDKs return tokens to the frontend and the backend validates them, so this implementation does not use a backend OAuth callback URI.

## Frontend `.env`

```env
VITE_GOOGLE_CLIENT_ID=
VITE_FACEBOOK_APP_ID=
VITE_MICROSOFT_CLIENT_ID=
VITE_MICROSOFT_TENANT_ID=common
```

Restart Vite after changing `.env`. Never put a client secret into a `VITE_*` variable because Vite exposes it to the browser.

## Backend configuration

The backend reads `Aplikacija/MatchYourMatch.WebAPI/.env` through DotNetEnv. Public IDs use:

```env
Authentication__Google__ClientId=
Authentication__Microsoft__ClientId=
Authentication__Microsoft__TenantId=common
```

Secrets, when needed, belong only in ASP.NET user-secrets or deployment environment variables:

```powershell
dotnet user-secrets set "Authentication:Google:ClientSecret" "VALUE"
dotnet user-secrets set "Authentication:Facebook:AppSecret" "VALUE"
dotnet user-secrets set "Authentication:Microsoft:ClientSecret" "VALUE"
```

The current Google and Microsoft ID-token flows do not require their client secrets. Facebook token introspection requires Facebook App Secret when Facebook is enabled.

## Google

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Configure the OAuth consent screen and create an OAuth 2.0 **Web application** client.
3. Add this exact Authorized JavaScript origin:

   ```text
   http://localhost:5173
   ```

4. No redirect URI is needed for the current Google Identity Services popup/ID-token flow.
5. Copy Client ID to frontend `VITE_GOOGLE_CLIENT_ID` and backend `Authentication__Google__ClientId`.

## Meta / Facebook

Facebook can remain unconfigured. When access becomes available:

1. Open [Meta for Developers](https://developers.facebook.com/apps/) and create a Consumer app.
2. Add Facebook Login for Web and set website URL to `http://localhost:5173/`.
3. Add these exact Valid OAuth Redirect URIs:

   ```text
   http://localhost:5173/
   http://localhost:5173/login
   http://localhost:5173/register
   ```

4. Enable `public_profile` and `email`.
5. Put App ID in frontend `VITE_FACEBOOK_APP_ID` and backend `Authentication:Facebook:AppId`.
6. Put App Secret only in backend `Authentication:Facebook:AppSecret` user-secrets/environment configuration.

## Microsoft

1. Open [Microsoft Entra → App registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade).
2. Create an app registration and select the required supported account types. `common` requires an app registration that accepts the intended personal/work/school account types.
3. Under **Authentication**, add a **Single-page application** redirect URI:

   ```text
   http://localhost:5173/
   ```

4. Enable ID tokens. MSAL requests `openid`, `profile`, and `email`.
5. Copy Application (client) ID to frontend `VITE_MICROSOFT_CLIENT_ID` and backend `Authentication__Microsoft__ClientId`.
6. Keep `common`, or copy Directory (tenant) ID to both frontend and backend tenant variables for a single-tenant app.

## Backend endpoints

- `POST http://localhost:5166/api/auth/external-login/google`
- `POST http://localhost:5166/api/auth/external-login/facebook`
- `POST http://localhost:5166/api/auth/external-login/microsoft`
- `PUT http://localhost:5166/api/auth/complete-social-profile`

Missing provider configuration produces a provider-specific message. Provider tokens are validated and discarded; only the MYM JWT is used as the application session.
