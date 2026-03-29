# Card Frontend Scaffold

React + TypeScript scaffold prepared to integrate with the Card API.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create local environment file:

```bash
cp .env.example .env
```

3. Update environment values:

- `VITE_API_BASE_URL`: Base URL for card-api, such as `http://localhost:3000`.
- `VITE_FRONTEND_API_KEY`: Value expected by `X-API-Key` for user routes.

4. Start dev server:

```bash
npm run dev
```

## Included Scaffold

- Auth context with login/logout token lifecycle.
- Axios API client with Authorization and optional X-API-Key headers.
- React Router structure for home, login, register, and protected app routes.
- React Query setup for server data fetching.
- Initial card pages:
  - Card list
  - Card detail
  - Card create

## Next Implementation Steps

1. Implement register, activate, and password reset forms.
2. Add card update and delete flows.
3. Add template browser and preview integration.
4. Add integration and e2e tests for auth + card CRUD.
