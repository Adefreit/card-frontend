# Admin Section API Summary

This document is intended for the frontend team building the admin section.

All admin endpoints live under `/v1/admin` and require:

- A valid JWT
- A user whose token includes the `ADMIN` permission
- Standard API authentication already used by the rest of the app

The backend also applies row-level security for these requests.

## Base Expectations

- Base path: `/v1/admin`
- Auth header: `Authorization: Bearer <jwt>`
- Content type for JSON writes: `application/json`
- All list endpoints currently return pagination echo fields when pagination is supported
- All admin mutations are audit logged on the backend

## Recommended Frontend Sections

1. Admin health and diagnostics
2. User search and detail view
3. User permissions management
4. User subscription management
5. User card management
6. Fulfillment queue for orders
7. Audit log browser

## Service Groups

### 1. Health

#### `GET /v1/admin/health`

Use this for a lightweight admin shell readiness check.

Typical response:

```json
{
  "response": "Admin API ready",
  "timestamp": "2026-04-23T12:34:56.000Z"
}
```

Frontend use:

- Verify admin access after login
- Show admin API health badge
- Fail fast if the user is authenticated but not authorized

### 2. Audit Events

#### `GET /v1/admin/audit-events`

Query params:

- `page`
- `pageSize`
- `resourceType`
- `action`
- `actorUserID`

Typical response shape:

```json
{
  "events": [
    {
      "id": "...",
      "create_time": "...",
      "actor_user_id": "...",
      "action": "users.permission_grant",
      "resource_type": "user",
      "resource_id": "...",
      "metadata": {}
    }
  ],
  "page": 1,
  "pageSize": 25
}
```

Frontend use:

- Build an audit log page
- Filter by actor, resource type, or action
- Use metadata for change context when available

### 3. User Search and User Detail

#### `GET /v1/admin/users`

Query params:

- `page`
- `pageSize`
- `userID`
- `email`
- `q`

Behavior:

- `userID` performs direct filtering by user id
- `email` performs exact email filtering
- `q` performs partial search across user id and email
- Response excludes `password` and `activation_code`
- Response includes `permissions`

Typical response shape:

```json
{
  "users": [
    {
      "id": "...",
      "email": "admin@example.com",
      "activated": true,
      "account_subscription_until": "2026-12-31T00:00:00.000Z",
      "subscription_type": "FOUNDER",
      "settings": {},
      "permissions": ["ADMIN", "FOUNDER"]
    }
  ],
  "page": 1,
  "pageSize": 25
}
```

Frontend use:

- Primary admin user directory table
- Support exact lookups and freeform search box
- Show permissions inline in the result grid

#### `GET /v1/admin/users/:id`

Returns one user record plus permissions.

Frontend use:

- User detail page header
- Left rail or summary panel for account state

### 4. User Permissions

#### `GET /v1/admin/users/:id/permissions`

Response shape:

```json
{
  "userID": "...",
  "permissions": ["ADMIN", "FOUNDER"]
}
```

#### `POST /v1/admin/users/:id/permissions`

Request body:

```json
{
  "permission": "ADMIN"
}
```

Response shape:

```json
{
  "userID": "...",
  "permissions": ["ADMIN", "FOUNDER"]
}
```

#### `DELETE /v1/admin/users/:id/permissions/:permission`

Response shape matches the grant endpoint.

Important behavior:

- The backend blocks an admin from removing their own `ADMIN` permission
- Failed grants currently return a `400` when the permission could not be added
- Failed revokes return `404` if the permission is not present on the target user

Frontend use:

- Permissions tab on user details
- Add/remove permission chips
- Disable the self-remove action for `ADMIN` in the UI as well

### 5. User Subscription Management

#### `POST /v1/admin/users/:id/extend-subscription`

Request body:

```json
{
  "days": 30
}
```

Typical response:

```json
{
  "response": "Subscription extended",
  "account_subscription_until": "2026-06-01T00:00:00.000Z"
}
```

Frontend use:

- Subscription operations panel in user detail view
- Quick actions like `+30 days`, `+90 days`, `+365 days`

### 6. User Card Management

#### `GET /v1/admin/users/:id/cards`

Returns the target user and their cards.

Typical response shape:

```json
{
  "userID": "...",
  "cards": [
    {
      "id": "...",
      "create_time": "...",
      "data": {
        "title": "...",
        "subtitle": "..."
      },
      "user_id": "...",
      "minted": false,
      "minted_at": null,
      "last_render": "signed-or-null",
      "last_proof": "signed-or-null"
    }
  ]
}
```

Frontend use:

- Cards tab under a user
- Show minted state, preview availability, and proof availability
- Use `last_render` for thumbnail display when present

#### `GET /v1/admin/cards/:id/artifacts/:artifactType`

Path params:

- `id`: card id
- `artifactType`: `preview` or `proof`

Typical response:

```json
{
  "cardID": "...",
  "userID": "...",
  "artifactType": "preview",
  "url": "https://...signed-url..."
}
```

Important behavior:

- This endpoint returns a signed URL wrapper, not the file bytes
- The frontend should treat the returned URL as short-lived
- Do not persist the signed URL client-side beyond the immediate view/download need

Frontend use:

- Download proof button
- Open preview in a modal or new tab
- Regenerate by re-requesting the endpoint instead of caching long-term

#### `POST /v1/admin/cards/:id/mint`

No request body required.

Typical response:

```json
{
  "response": "Card minted",
  "card": { }
}
```

Behavior:

- Marks the card as minted if it is not already minted
- Clears old preview/proof pointers during the mint flow
- Rebuilds the preview for the minted state

#### `POST /v1/admin/cards/:id/unmint`

No request body required.

Typical response:

```json
{
  "response": "Card unminted",
  "card": { }
}
```

Behavior:

- Clears `minted` and `minted_at`
- Deletes stored render/proof artifacts from storage when present
- Regenerates a fresh unminted preview

Frontend use:

- Card operations menu in the admin card detail or card list row
- Confirm dialog strongly recommended before unmint

### 7. Fulfillment Queue and Order Operations

#### `GET /v1/admin/orders`

Query params:

- `page`
- `pageSize`
- `userID`
- `orderType` as `purchase_item`, `subscription`, or `mint`
- `fulfillmentStage` as `pending`, `processing`, `printing`, `shipping`, or `delivered`
- `createdAfter`
- `createdBefore`

Important behavior:

- This endpoint is intentionally focused on orders still relevant to fulfillment work
- It only returns orders whose payment status is one of:
  - `paid`
  - `fulfilled`
  - `partially_refunded`
- It excludes orders already at fulfillment stage `delivered`

Typical response shape:

```json
{
  "orders": [
    {
      "id": "...",
      "user_id": "...",
      "status": "paid",
      "order_type": "mint",
      "fulfillment_stage": "processing",
      "fulfillment_update_time": "...",
      "fulfillment_actor_user_id": "...",
      "items": []
    }
  ],
  "page": 1,
  "pageSize": 25
}
```

Frontend use:

- Main fulfillment queue table
- Filters for type, stage, date, and user
- Highlight payment status separately from fulfillment stage

#### `POST /v1/admin/orders/:id/fulfillment-stage`

Request body:

```json
{
  "fulfillmentStage": "shipping"
}
```

Returns the updated order object.

Important behavior:

- This does not change payment `status`
- Valid transitions are forward-only and one step at a time
- Allowed sequence:
  - `pending`
  - `processing`
  - `printing`
  - `shipping`
  - `delivered`
- Invalid transitions return `400`

Frontend use:

- Stage-change dropdown or stepper in the fulfillment queue
- Disable jumping multiple stages in one action
- Disable backwards transitions in the UI

## Suggested Frontend Screen Structure

### Admin home

- Call `GET /v1/admin/health`
- Show quick links to Users, Orders, Audit

### Users page

- Main search input mapped to `q`
- Optional exact search by email or user id
- Results table from `GET /v1/admin/users`

### User detail page

- Summary panel from `GET /v1/admin/users/:id`
- Permissions tab using:
  - `GET /v1/admin/users/:id/permissions`
  - `POST /v1/admin/users/:id/permissions`
  - `DELETE /v1/admin/users/:id/permissions/:permission`
- Subscription tab using:
  - `POST /v1/admin/users/:id/extend-subscription`
- Cards tab using:
  - `GET /v1/admin/users/:id/cards`

### Card actions

- Preview button using `GET /v1/admin/cards/:id/artifacts/preview`
- Proof button using `GET /v1/admin/cards/:id/artifacts/proof`
- Mint button using `POST /v1/admin/cards/:id/mint`
- Unmint button using `POST /v1/admin/cards/:id/unmint`

### Fulfillment queue

- Load queue from `GET /v1/admin/orders`
- Use filters for order type, stage, and date range
- Update stage with `POST /v1/admin/orders/:id/fulfillment-stage`

### Audit log

- Load with `GET /v1/admin/audit-events`
- Filter by `resourceType`, `action`, and `actorUserID`

## Error Handling Guidance

Common admin error patterns:

- `400`: validation failure, invalid transition, unsupported action, or malformed request
- `403`: authenticated but forbidden, including self-removal of `ADMIN`
- `404`: target user/card/order or artifact not found
- `500`: unexpected backend failure

For mutation UIs:

- Show backend `response` text when present
- Show backend `error` text in an expandable details region for operators
- Re-fetch the affected entity after successful mutations instead of relying only on optimistic updates

## Frontend Notes

- Keep payment status and fulfillment stage visually separate in the UI
- Treat signed artifact URLs as temporary
- Confirm destructive actions like unmint and permission revoke
- Prefer server refresh after each mutation because multiple endpoints also trigger side effects like audit logging, render regeneration, or storage cleanup
