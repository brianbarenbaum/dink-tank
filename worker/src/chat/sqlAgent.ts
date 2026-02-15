import { ChatOpenAI } from "@langchain/openai";
import { createAgent, tool } from "langchain";
import { Pool } from "pg";
import * as z from "zod";

import type { WorkerEnv } from "../env";
import { buildSqlSystemPrompt } from "./prompt";
import { sanitizeSqlQuery } from "./sqlSafety";

let cachedPool: Pool | null = null;
let cachedPoolUrl: string | null = null;
let cachedSchema: string | null = null;

const resolveConnectionString = (env: WorkerEnv): string => {
  const raw = env.SUPABASE_DB_URL.trim();
  if (!raw) {
    return raw;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return raw;
  }

  if (parsed.searchParams.has("sslmode")) {
    return parsed.toString();
  }

  parsed.searchParams.set(
    "sslmode",
    env.SUPABASE_DB_SSL_NO_VERIFY ? "no-verify" : "require",
  );
  return parsed.toString();
};

const getPool = (env: WorkerEnv): Pool => {
  const connectionString = resolveConnectionString(env);
  if (cachedPool && cachedPoolUrl === connectionString) {
    return cachedPool;
  }

  cachedPool = new Pool({
    connectionString,
    ssl: env.SUPABASE_DB_SSL_NO_VERIFY
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: env.SQL_QUERY_TIMEOUT_MS,
    query_timeout: env.SQL_QUERY_TIMEOUT_MS,
    allowExitOnIdle: true,
  });
  cachedPoolUrl = connectionString;
  cachedSchema = null;

  return cachedPool;
};

const getSchemaInfo = async (pool: Pool): Promise<string> => {
  if (cachedSchema) {
    return cachedSchema;
  }

  const query = `
SELECT
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position
`;
  const result = await pool.query<{
    table_schema: string;
    table_name: string;
    column_name: string;
    data_type: string;
  }>(query);

  if (result.rows.length === 0) {
    cachedSchema = "No visible tables were found in this database.";
    return cachedSchema;
  }

  const lines: string[] = [];
  let currentTable = "";

  for (const row of result.rows) {
    const tableId = `${row.table_schema}.${row.table_name}`;
    if (tableId !== currentTable) {
      if (currentTable) {
        lines.push("");
      }
      currentTable = tableId;
      lines.push(`${tableId}:`);
    }
    lines.push(`- ${row.column_name} (${row.data_type})`);
  }

  cachedSchema = lines.join("\n");
  return cachedSchema;
};

const runReadOnlySql = async (pool: Pool, query: string): Promise<string> => {
  const result = await pool.query(query);
  if (result.rows.length === 0) {
    return "[]";
  }

  return JSON.stringify(result.rows, null, 2);
};

const extractAgentText = (result: unknown): string => {
  if (!result || typeof result !== "object") {
    return "I could not generate a response.";
  }

  const candidate = result as {
    output?: string;
    messages?: Array<{ content?: unknown }>;
  };

  if (
    typeof candidate.output === "string" &&
    candidate.output.trim().length > 0
  ) {
    return candidate.output;
  }

  const lastMessage = candidate.messages?.at(-1);
  if (
    typeof lastMessage?.content === "string" &&
    lastMessage.content.trim().length > 0
  ) {
    return lastMessage.content;
  }

  return "I could not generate a response.";
};

export const runSqlAgent = async (
  env: WorkerEnv,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> => {
  const pool = getPool(env);
  const schema = await getSchemaInfo(pool);

  const executeSql = tool(
    async ({ query }) => {
      const sanitized = sanitizeSqlQuery(query);
      return runReadOnlySql(pool, sanitized);
    },
    {
      name: "execute_sql",
      description: "Execute a read-only SQL query.",
      schema: z.object({ query: z.string() }),
    },
  );

  const model = new ChatOpenAI({
    apiKey: env.OPENAI_API_KEY,
    model: env.LLM_MODEL,
    temperature: 1,
    timeout: env.SQL_QUERY_TIMEOUT_MS,
  });

  const agent = createAgent({
    model,
    tools: [executeSql],
    systemPrompt: buildSqlSystemPrompt(schema),
  });

  const response = await agent.invoke({ messages });
  return extractAgentText(response);
};
