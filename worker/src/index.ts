export interface Env {
  OPENAI_API_KEY?: string;
  SUPABASE_DB_URL?: string;
  LLM_MODEL?: string;
  SQL_QUERY_TIMEOUT_MS?: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return json(
        {
          error: "not_implemented",
          message: "Chat backend is scaffolded but not implemented yet.",
        },
        501,
      );
    }

    return json({ error: "not_found" }, 404);
  },
};
