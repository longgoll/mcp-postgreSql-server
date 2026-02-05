# PostgreSQL MCP Server 🐘

[English](README.md) | [Tiếng Việt](README.vi.md)

A robust **Model Context Protocol (MCP)** server for PostgreSQL databases. This server allows AI assistants (like Claude, Antigravity, or VS Code extensions) to safely interact with your PostgreSQL data, perform queries, and inspect schemas.

## 🌟 Features

- **Direct Database Access**: Connect to any PostgreSQL database using a connection string.
- **Schema Inspection**: Easily view tables, columns, constraints, and indexes.
- **Full Text Search**: Search for content across all text columns in a table.
- **Performance Analysis**: Run `EXPLAIN` to see query execution plans.
- **Safety First**: Separate tools for read-only (`SELECT`) and modification queries.

## 🛠️ Available Tools

| Tool                     | Description                                                             |
| ------------------------ | ----------------------------------------------------------------------- |
| `list_tables`            | List all tables in the `public` schema.                                 |
| `describe_table`         | Get detailed schema information (columns, types, defaults) for a table. |
| `list_indexes`           | View all indexes on a specific table.                                   |
| `list_constraints`       | View Primary Keys, Foreign Keys, and other constraints.                 |
| `search_in_table`        | Search for a text string in any text column of a table.                 |
| `run_read_only_query`    | Execute safe `SELECT` queries. Blocks modification commands.            |
| `run_modification_query` | Execute `INSERT`, `UPDATE`, `DELETE`, `CREATE` commands.                |
| `explain_query`          | Get the JSON execution plan for performance tuning.                     |

## 🚀 Installation & Setup

### 1. Prerequisites

- Node.js (v18 or higher)
- A running PostgreSQL database

### 2. Installation

Clone this repository and install dependencies:

```bash
git clone <your-repo-url>
cd mcp-postgre-server
npm install
```

### 3. Configuration (.env)

Create a `.env` file in the root directory to store your database credentials.
**Important**: Never commit your real `.env` file to version control.

```bash
cp .env.example .env
```

Edit `.env` and set your `DATABASE_URL`:

```env
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/mydatabase
```

### 4. Build

Compile the TypeScript code:

```bash
npm run build
```

## 🔌 Connect to Clients

### VS Code (Claude / MCP Extension) & Antigravity

To use this server with MCP-compliant clients, add the following configuration to your MCP settings file (e.g., `mcp_config.json` or VS Code extension settings).

**Config Path (Example):**

- Windows: `%APPDATA%\Code\User\globalStorage\mcp-server\mcp_settings.json` (varies by extension)
- Antigravity: `c:\Users\<User>\.gemini\antigravity\mcp_config.json`

**JSON Configuration:**

```json
{
  "mcpServers": {
    "postgre-server": {
      "command": "node",
      "args": ["D:\\Path\\To\\mcp-postgre-server\\build\\index.js"],
      "env": {
        "DATABASE_URL": "postgresql://myuser:mypassword@localhost:5432/mydatabase"
      }
    }
  }
}
```

> **Note**: You can either set `DATABASE_URL` in the `.env` file (if you run the server from the correct working directory) or pass it directly in the `env` section of the JSON config as shown above. Using the JSON config is often more reliable for absolute paths.

## 🔒 Security

- **Read-Only Enforcement**: The `run_read_only_query` tool implements a basic check to prevent `INSERT/UPDATE/DELETE` keywords.
- **Input Sanitization**: Table names are validated in search tools to prevent SQL injection.

## 📜 License

ISC
