# Admin error-log cleanup

The previous screen treated any error-free DELETE response as success, even if
row-level security silently filtered every record. The original error_logs migration
only defined INSERT/SELECT access for browser roles, with no administrator DELETE
policy. The 113 old records therefore remained visible after a success notification.

Cleanup now calls DELETE /api/admin/clear-error-logs. The Vercel server:

1. Validates the supplied user access token with Supabase Auth.
2. Checks public.has_role(user.id, admin). Anonymous, expired and store-user
   requests cannot trigger deletion; permission-check failures fail closed.
3. Deletes using the server-only service role and requests an exact affected count.
4. Verifies that no matching records remain before returning success.

The server chooses its own time cutoff. Errors created after that cutoff remain;
legacy records with NULL created_at are also covered. No arbitrary table/filter
or administrator identity is accepted from the browser.

The UI validates the returned count, displays the actual number removed, blocks
repeat clicks, and refreshes both the table and sidebar count on success or failure.
It never infers that the entire table is empty merely from the delete response.

Deployment requires SUPABASE_SERVICE_ROLE_KEY as a sensitive Production Vercel
environment variable. It is never a VITE variable, committed value or browser asset.
The URL uses SUPABASE_URL or the existing VITE_SUPABASE_URL. No SQL migration or
broader browser DELETE permission is necessary. The SPA rewrite excludes /api/.

Validation: 64 Vitest tests, including administrator authorization, missing sessions,
failed/zero-row deletes, exact-count validation, sidebar refresh and repeated clicks.
The server passes its standalone TypeScript check. A live zero-match DELETE returned
204 with Content-Range */0; real has_role checks returned true for an admin and false
for a non-admin ID. A full physical/browser admin-session test still requires the
user's logged-in session; no identity was impersonated to run these checks.
