# Delivery and printing diagnosis, 2026-10-19

## Confirmed production error

The 113 error rows inspected contained 112 occurrences of the cart-upsell
constructor error and one generic script error. The Lucide Map icon shadowed
the JavaScript Map constructor. StoreMenu now explicitly uses globalThis.Map.
Existing error history is preserved. This error was not evidence of a printer failure.

## Website behavior

The browser checks the local agent before submitting a job. Automatic submissions
retry this check up to three times, five seconds apart; no order has been sent yet.
Manual printing may fall back to browser printing only when this initial check fails.
Once a POST has been attempted, a failure/timeout has uncertain delivery and never
opens a second print path automatically. The response timeout is now three minutes
instead of twelve seconds, allowing the agent to process a queued request.

Automatic calls carry automatic=true, so the new agent deduplicates them against
its own realtime/poll processing. Explicit manual printing still permits reprinting.
Browser failures are recorded in error_logs. Old agents remain protocol compatible,
but their internal false-success behavior requires installing the new executable.

## Agent 1.0.6

- Reports success/failure for each submitted order instead of swallowing failures
  and returning unconditional success from /api/print-order.
- Serializes jobs to each printer, with deduplication checked inside the queue.
- Persists pending, sending, failed and printed states, reading legacy numeric history.
- Writes history using a temporary file followed by rename and retains unresolved
  jobs when pruning completed history.
- Preserves known pending/failed jobs during startup baseline initialization.
- Treats interrupted sending as uncertain after restart. A transport error also has
  uncertain delivery; automatic transport retries were removed to avoid duplicate
  paper after partial transmission. Inspect the printer, then reprint manually.
  Legacy retry configuration remains readable for compatibility but is not used
  to repeat an uncertain transport send.
- Retries document-generation failures through the existing periodic scan, since
  no bytes have been submitted in that case.
- Sends error-level local logs to existing Supabase error_logs after authenticating,
  with store_id, print_agent_error metadata, token redaction, and a one-minute
  duplicate-message limit. Remote logging is best effort and never blocks printing.
  When the agent cannot authenticate or has no internet, local logs remain necessary.

A successful send means delivery to the driver/transport, not confirmation that
paper physically emerged. Historical baseline skipping of previously unknown
orders remains to avoid printing the previous shift. Recovery of old missing orders
requires inspecting the store's agent logs and manually selecting affected orders.
Deduplication is local to one agent installation, not a cross-computer guarantee.

## Validation and rollout

49 Vitest tests pass, including concurrent events, transport and partial-copy failure,
explicit reprint, startup preservation, legacy history and browser timeout handling.
Website development build and agent typecheck/build/package pass. App typecheck
still reports six pre-existing Dashboard.tsx Postgrest builder/Promise errors.

The website can be deployed independently. The agent executable is prepared locally;
do not change the shared update manifest or automatically distribute it before
checking the installed version, configuration and physical printer at the store.
No database migration is required. Existing local uncommitted work was preserved
by implementing this release in a separate Git worktree.
