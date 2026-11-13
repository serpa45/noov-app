# Supabase Pro usage monitoring

The metrics page now distinguishes current database/file occupancy from usage
metered over a billing cycle. In particular, uncached egress and cached egress
have independent references of 250 GB on Pro. Neither can be inferred from file
sizes, the number of visitors, API request counts, or a project SQL size RPC.

## Data sources and limits

- Existing `get_system_usage` remains the automatic source for current database
  and object sizes and operational counts. No additional polling of billing APIs
  or logs was introduced.
- Billing counters are **manual observations from the Supabase usage dashboard**.
  There is no automatic cached/uncached egress collector in this release.
- The page provides 15 numeric references: both egress types, cycle-average
  storage, provisioned disk, Auth/Third-Party/SSO MAU, Realtime messages and peak
  connections, function invocations, transformed origin images, ingested and
  queried logs, provisioned IOPS and disk throughput. Variable entitlements do
  not receive fabricated numeric limits. gp3 references do not describe io2 disks.
- Other billing categories and service-specific operational limits link to their
  current official documentation. CPU/RAM/connection capacity depends on the
  selected instance; this page does not presume a compute size or change it.
- References were checked against official documentation on 2026-11-13. The user
  confirmed the Pro plan. Custom contract references can be entered explicitly.

## Manual readings

Administrators enter cycle start/end, observation time and readings. Empty fields
are missing readings, not zero. A measured zero must be entered explicitly.
Numbers accept either decimal separator without thousands grouping. Validation
rejects cross-project imports, negative/non-finite values, fractional user counts,
future observations, malformed calendar dates, and excessively long billing cycles.

Consumption alerts appear at 80/90/100 percent. Provisioned quantities exactly at
the included reference are not treated as an overage. Snapshots older than 24h
and snapshots outside their cycle are explicitly flagged; the application never
resets them to zero. There are **no background/email notifications** and refreshing
the page does not collect the latest billing usage. Repeated values and the
observation timestamp must be checked against the Supabase dashboard when edited.

Export/import uses validated JSON. Imported observations replace the shared reading
only after confirmation. This is a monitoring aid, not an invoice/cost forecast or
a guarantee against excess charges. Organization quotas may be shared with other
projects; project-scoped disk readings must not be mistaken for organization totals.

## Shared private persistence

`GET/PUT /api/admin/supabase-quota-readings` validates the user token through Auth,
checks `has_role(user.id, admin)`, and uses server-only service credentials for the
fixed private bucket `noov-system-metrics-private` and fixed object
`pro-usage-reading.json`. The browser cannot choose another bucket/object/project.
Responses disable caching. Successful saves require a successful Storage upload;
read failures are explicit. An absent object is returned as `snapshot: null`.

The bucket is private, accepts JSON files up to 200000 bytes, and was provisioned
through the supported Storage API. No SQL tables, policies or public grants were
changed. On a new installation, create the same private bucket with the same MIME
and file-size restrictions using server credentials. Do not make it public or grant
generic browser access. Production Vercel requires the existing sensitive
`SUPABASE_SERVICE_ROLE_KEY` and project URL; no privileged key is a VITE variable.

## Verification

97 Vitest tests pass, including alert thresholds, cache/uncached independence,
missing vs explicit zero, stale/previous-cycle readings, count/date validation,
Brazilian decimals, server administrator checks, failed writes, shared UI saves,
and resetting inputs on cycle changes. The app builds successfully and the new
server function passes standalone Node ESM TypeScript validation. The whole-app
typecheck retains six unrelated pre-existing Dashboard.tsx TS2739 errors.

A real temporary canary object was uploaded, read through privileged access,
denied via public/anonymous paths, then removed. The private bucket remains.
`get_system_usage` returned HTTP 200. The actual SDK absence response was checked
(`StorageApiError`, HTTP 400 with legacy `statusCode: 404`). No billing counters were
invented or seeded as zero. A physical logged-in administrator browser session is
still required to enter and confirm the real billing observations.

## Official sources

- https://supabase.com/docs/guides/platform/manage-your-usage
- https://supabase.com/docs/guides/platform/manage-your-usage/egress
- https://supabase.com/docs/guides/platform/manage-your-usage/storage-size
- https://supabase.com/docs/guides/platform/manage-your-usage/disk-size
- https://supabase.com/pricing

Each metric and additional billing item also links directly to its documentation
inside the application. For local Windows CLI use, the system CA store may be
needed (`--use-system-ca`); TLS verification must remain enabled.
