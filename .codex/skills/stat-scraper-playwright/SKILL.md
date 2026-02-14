---
name: stat-scraper-playwright
description: Automate internal API extraction using Playwright MCP tools within the Codex CLI.
version: 1.0.0
triggers:
  - keywords: ["scrape", "network panel", "internal api", "crossclub stats"]
---

# Skill: Playwright Stat Scraper

## Intent
Use the Codex-integrated Playwright tools to extract structured JSON from hidden APIs.

## Core Procedures

1. **Network Interception:**
   - Use Codex tools to listen for XHR/Fetch responses.
   - **Target:** Identify endpoints returning team, player and match data in the network tab.

2. **Data Normalization:**
   - Map raw JSON to our Supabase schema (or create schema based on output from JSON if schema does not exist)
   - Ensure ISO date strings and numerical win/loss ratios.

3. **Supabase Integration:**
   - Use the `supabase-mcp`
