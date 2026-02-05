#!/usr/bin/env node
// Redirect console.log to stderr to avoid breaking MCP protocol on stdout
const originalLog = console.log;
console.log = console.error;

import { fileURLToPath } from 'url';

import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// We are in /build/index.js, so .env is in ../.env
dotenv.config({ path: join(__dirname, '..', '.env') });

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";

// Define the arguments types manually to avoid Zod complexity for now in simple handler
// or just cast `args`.

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

// We will use a pool. If DATABASE_URL is not provided, the pool will try to use
// default PG environment variables (PGHOST, PGUSER, etc.)
const pool = new Pool(DATABASE_URL ? { connectionString: DATABASE_URL } : undefined);

// Add global error handler for the pool to prevent process crash on idle client errors
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

const server = new Server(
  {
    name: "mcp-postgre-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Helper for query execution
async function runQuery(sql: string, args: any[] = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, args);
    return result;
  } finally {
    client.release();
  }
}

// List Resources (Expose tables as resources)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const client = await pool.connect();
    try {
        const sql = `
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog') 
            ORDER BY table_schema, table_name
        `;
        const result = await client.query(sql);
        
        const resources = result.rows.map(row => ({
            uri: `postgres://${row.table_schema}/${row.table_name}`,
            mimeType: "application/json",
            name: `${row.table_schema}.${row.table_name}`,
            description: `Table ${row.table_name} in schema ${row.table_schema}`
        }));

        return {
            resources
        };
    } finally {
        client.release();
    }
});

// Read Resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const url = new URL(uri);
    
    // Validate protocol
    if (url.protocol !== 'postgres:') {
        throw new Error("Invalid resource protocol");
    }

    const pathParts = url.pathname.split('/').filter(p => p.length > 0);
    // Expecting //hostname/schema/table or //schema/table depending on URL parsing
    // URL("postgres://public/users") -> hostname="public", pathname="/users"
    
    let schema, table;
    if (url.hostname) {
        schema = url.hostname;
        table = pathParts[0];
    } else {
        // Fallback if hostname is empty (unlikely with valid URI)
        schema = pathParts[0];
        table = pathParts[1];
    }

    if (!schema || !table) {
        throw new Error("Invalid resource URI format. Expected postgres://schema/table");
    }

    // Safety checks
    if (!/^[a-zA-Z0-9_]+$/.test(schema) || !/^[a-zA-Z0-9_]+$/.test(table)) {
        throw new Error("Invalid schema or table name in URI");
    }

    const client = await pool.connect();
    try {
        // Read first 100 rows as a preview
        const sql = `SELECT * FROM "${schema}"."${table}" LIMIT 100`;
        const result = await client.query(sql);

        return {
            contents: [{
                uri: uri,
                mimeType: "application/json",
                text: JSON.stringify(result.rows, null, 2)
            }]
        };
    } finally {
        client.release();
    }
});

// List Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_tables",
        description: "List all tables and views in the database (includes schema information)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "describe_table",
        description: "Get schema information for a table",
        inputSchema: {
          type: "object",
          properties: {
            table_name: { type: "string" },
          },
          required: ["table_name"],
        },
      },
      {
        name: "list_indexes",
        description: "List indexes for a specific table",
        inputSchema: {
            type: "object",
            properties: {
                table_name: { type: "string" },
            },
            required: ["table_name"]
        }
      },
      {
        name: "list_constraints",
        description: "List constraints (PK, FK, Unique, Check) for a specific table",
        inputSchema: {
            type: "object",
            properties: {
                table_name: { type: "string" },
            },
            required: ["table_name"]
        }
      },
      {
        name: "run_read_only_query",
        description: "Execute a read-only SQL query (SELECT)",
        inputSchema: {
          type: "object",
          properties: {
            sql_query: { type: "string" },
          },
          required: ["sql_query"],
        },
      },
      {
        name: "explain_query",
        description: "Get the execution plan for a query (EXPLAIN)",
        inputSchema: {
          type: "object",
          properties: {
            sql_query: { type: "string" },
          },
          required: ["sql_query"],
        },
      },
      {
          name: "search_in_table",
          description: "Search for a text string in all text columns of a table",
          inputSchema: {
              type: "object",
                  properties: {
                      table_name: { type: "string" },
                      search_term: { type: "string" }
                  },
              required: ["table_name", "search_term"]
          }
      },
      {
        name: "run_modification_query",
        description: "Execute a modification SQL query (INSERT, UPDATE, DELETE, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            sql_query: { type: "string" },
          },
          required: ["sql_query"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const safeArgs = args as Record<string, any>;

  try {
    if (name === "list_tables") {
      const result = await runQuery(
        `SELECT table_schema, table_name, table_type 
         FROM information_schema.tables 
         WHERE table_schema NOT IN ('information_schema', 'pg_catalog') 
         ORDER BY table_schema, table_name`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
      };
    }

    if (name === "describe_table") {
      const tableName = safeArgs.table_name;
      const result = await runQuery(
        "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
        [tableName]
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
      };
    }

    if (name === "list_indexes") {
        const tableName = safeArgs.table_name;
        const sql = `
            SELECT
                i.relname as index_name,
                a.attname as column_name,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary
            FROM
                pg_class t,
                pg_class i,
                pg_index ix,
                pg_attribute a
            WHERE
                t.oid = ix.indrelid
                AND i.oid = ix.indexrelid
                AND a.attrelid = t.oid
                AND a.attnum = ANY(ix.indkey)
                AND t.relkind = 'r'
                AND t.relname = $1
            ORDER BY
                t.relname,
                i.relname;
        `;
        const result = await runQuery(sql, [tableName]);
        return {
            content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }]
        };
    }

    if (name === "list_constraints") {
        const tableName = safeArgs.table_name;
        const sql = `
            SELECT
                conname as constraint_name,
                contype as constraint_type,
                pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = $1::regclass
        `;
        // Handle generic error if table doesn't exist by try-catch in runQuery wrapper effectively,
        // but here we might get 'relation does not exist' error which we catch below.
        const result = await runQuery(sql, [tableName]);
        
        // Map constraint types for better readability
        const typeMap: Record<string, string> = {
            'p': 'PRIMARY KEY',
            'f': 'FOREIGN KEY',
            'u': 'UNIQUE',
            'c': 'CHECK',
            't': 'TRIGGER',
            'x': 'EXCLUSION'
        };
        
        const friendlyRows = result.rows.map(r => ({
            ...r,
            constraint_type_desc: typeMap[r.constraint_type] || r.constraint_type
        }));

        return {
            content: [{ type: "text", text: JSON.stringify(friendlyRows, null, 2) }]
        }
    }

    if (name === "search_in_table") {
        const tableName = safeArgs.table_name;
        const term = safeArgs.search_term;
        
        // 1. Get text columns
        const colsResult = await runQuery(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = $1 AND data_type IN ('text', 'character varying', 'char', 'name')`,
            [tableName]
        );
        
        const columns = colsResult.rows.map(r => r.column_name);
        if (columns.length === 0) {
            return { content: [{ type: "text", text: `No text columns found in table '${tableName}' to search.` }] };
        }

        // 2. Validate table name to prevent SQL Injection
        // Simple sanitization: only allow alphanumeric + underscore
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
             throw new Error("Invalid table name for search");
        }

        // 3. Build and Execute Query
        const safeSql = `SELECT * FROM "${tableName}" WHERE ${columns.map((col) => `"${col}" ILIKE $1`).join(" OR ")} LIMIT 50`;
        const searchResult = await runQuery(safeSql, [`%${term}%`]);
        
        return {
             content: [{ type: "text", text: JSON.stringify(searchResult.rows, null, 2) }]
        };
    }

    if (name === "run_read_only_query") {
      const sql = safeArgs.sql_query;
      // Basic readonly check
      if (!isReadOnly(sql)) {
        throw new Error("Query is not read-only. Use run_modification_query for this operation.");
      }
      const result = await runQuery(sql);
      return {
        content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
      };
    }

    if (name === "explain_query") {
        const sql = safeArgs.sql_query;
        // Postgres EXPLAIN (JSON format is best for programmatic) or TEXT
        const explainSql = `EXPLAIN (FORMAT JSON) ${sql}`;
        const result = await runQuery(explainSql);
        return {
            content: [{ type: "text", text: JSON.stringify(result.rows[0]['QUERY PLAN'], null, 2) }]
        };
    }

    if (name === "run_modification_query") {
      const sql = safeArgs.sql_query;
      const result = await runQuery(sql);
      return {
         content: [{ type: "text", text: JSON.stringify({
            rowCount: result.rowCount,
            command: result.command,
            rows: result.rows // sometimes modification returns rows (RETURNING clause)
         }, null, 2) }],
      };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

function isReadOnly(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();
  // Simple check, not perfect but prevents accidental DELETEs via this tool
  return normalized.startsWith("SELECT") || normalized.startsWith("WITH") || normalized.startsWith("EXPLAIN") || normalized.startsWith("VALUES");
}

const transport = new StdioServerTransport();
await server.connect(transport);
