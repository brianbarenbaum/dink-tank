# CrossClub Mock Data

These files are deterministic fixture payloads used to validate local SQLite ingestion.

## Scope
- Includes NJ / PA region and division 4.0 data.
- Includes one additional region/division to validate filtering.
- Includes regular + playoff matchups and matchup detail payloads.

## Files
- `regions.json`
- `players.json`
- `teams.json`
- `standings.json`
- `matchups.json`
- `playoff-matchups.json`
- `matchup-details.json`

The IDs are intentionally stable so tests can assert exact row counts and FK integrity.
