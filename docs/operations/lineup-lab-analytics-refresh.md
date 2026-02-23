# Lineup Lab Analytics Refresh

## Ownership
- Owner: CrossClub ingestion pipeline (`data-ingestion/pipeline.ts`)
- Refresh function: `analytics.refresh_lineup_analytics_views()`
- Trigger point: successful ingest completion for phases `all`, `matchups`, `playoff-matchups`, and `details`

## Refresh Contract
1. Ingest writes source tables (`lineup_slots`, `matchups`, supporting season/team/player tables).
2. Ingest calls `analytics.refresh_lineup_analytics_views()` via PostgREST RPC in schema `analytics`.
3. If refresh fails, ingest run is marked failed.
4. Worker recommendation responses expose bundle freshness metadata:
- `bundleMetadata.generatedAt`
- `bundleMetadata.maxLastSeenAt`
- `bundleMetadata.dataStalenessHours`
- optional warning when stale threshold is exceeded

## Why Ingest Owns Refresh
- Avoids split ownership between worker and ingestion paths.
- Ensures analytics objects are refreshed immediately after authoritative writes.
- Keeps runtime recommendation requests read-only and low-latency.

## Operational Checks
- Confirm latest ingest run status is `completed` in `public.ingest_runs`.
- Confirm `metadata.lineup_analytics_refreshed = true` for refresh-owning phases.
- If recommendations show stale warning, inspect:
1. Last successful ingest timestamp.
2. Ingest run errors around RPC refresh.
3. Recency of `max_last_seen_at` in lineup bundle payload.

## Manual Recovery
Use only when an ingest run completed data writes but refresh did not run:

```sql
select analytics.refresh_lineup_analytics_views();
```

Then re-run one recommendation request and verify `bundleMetadata.dataStalenessHours` drops.
