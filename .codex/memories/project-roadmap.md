# Project Roadmap: Cross Club Pickleball Bot

## Project Overview
An intelligent chatbot designed to streamline access to statistics and optimize team performance for Cross Club Pickleball.

- **Primary Source:** [https://www.crossclubpickleball.com/](https://www.crossclubpickleball.com/)
- **Core Goal:** Simplify stat retrieval and generate intelligent, data-driven team lineups.

## Design & Personality
- **UI/UX Style:** Mmodern LLM interface (comparable to Claude and ChatGPT) but with a twist -- It should be lightly inspired by classic terminal design using green-on-black.
- **Progressive Ehnancement:**  All pages must work on mobile, tablets and desktops
- **Design Images:** 
  - Designs for both desktop and mobile can be found at `/designs/chat_desktop.png` and `/designs/chat_mobile.png` respectively.
  - These designs should serve as strong inspiration.  The actual design should be close to these, but does not have to be exact pixel by pixel.  As we continue to work, we will iterate on these designs until we get exactly what we want.  As a design expert, I would like suggestions on how to improve the designs and useability as we work.

## Target Features
1. **Stat Retrieval Engine:** Efficiently pull and present individual and team stats from the Cross Club portal.
2. **Intelligent Lineup Generator:** An algorithm-based tool to suggest optimal pairings and lineups based on historical performance data.
3. **Chat-Driven Interface:** Users should be able to ask natural language questions (e.g., "Who has the highest win percentage in mixed doubles lately?").

## Front-End Tech Stack (Aligned with Agents)
- **Front-End Framework:** Vue 3 (Composition API) + Vite
- **Styling:** Tailwind CSS + shadcn-vue
- **State:** Pinia
- **Language:** TypeScript
- **Testing:** Vitest & Playwright
- **Served From:** Clodflare Pages

## Back-End Tech Stack (Aligned with Agents)
  - **Runtime:** Node.js
  - **LLM Integration:** LangChain SQL Agent
  - **Served From:** Cloudflare Workers
    
## User Authentication
  - **Front-End:**  Supabase Auth
  - **Cloudflware Workers:** Worker validates user's session by using access token in request headers from client

## Known Constraints
- Data retrieval must respect the source site's structure.
- Lineups must account for varying player availability and skill levels.
