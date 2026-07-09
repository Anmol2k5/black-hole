# Company Brain OS

A local-first, AI-maintained company second brain for startups. Company Brain OS compiles your messy raw data (customer calls, meeting notes, support tickets, PDFs, etc.) into a structured, cited internal wiki that both humans and AI agents can query.

## Core Features

- **Immutable Raw Sources**: Upload and store files securely on disk.
- **AI Ingestion Pipeline**: Automatically extracts text, chunks it, embeds it, and runs LLM extraction for insights (pain points, feature requests, bugs, quotes).
- **Auto-Compiled Wiki**: Generates and maintains structured Markdown pages (e.g., "Requested Features", "Pricing Objections") grouped by severity and frequency.
- **Cited Query Engine**: Ask questions and get answers backed by specific citations to the raw sources.
- **Full-Text & Vector Search**: Uses SQLite FTS5 for wiki search and Cosine Similarity for chunk search.
- **Configurable LLM Support**: Works with OpenAI, Anthropic, or any OpenAI-compatible endpoint (like AgentRouter or Ollama).

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS, shadcn/ui, lucide-react
- **Backend**: Next.js API Routes (Node.js)
- **Database**: SQLite (via `better-sqlite3`) for metadata, chunks, and citations
- **Storage**: Local filesystem for raw files and generated Markdown wiki pages
- **AI**: OpenAI SDK (compatible with any standard endpoint)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/Anmol2k5/black-hole.git
   cd black-hole/company-brain
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` to add your LLM API keys. (See Environment Variables below).

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Load Demo Data**
   - Open `http://localhost:3000`
   - Click "Load Demo Data" on the Upload page to ingest 10 fake customer transcripts.
   - Wait for the ingestion pipeline to complete (you can monitor this on the Jobs page).
   - Explore the generated Wiki and ask questions!

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| \`LLM_PROVIDER\` | The LLM provider (\`openai\`, \`anthropic\`, \`ollama\`) | \`openai\` |
| \`LLM_MODEL\` | The model to use for extraction and chat | \`gpt-4o-mini\` |
| \`LLM_API_KEY\` | Your API key | \`\` |
| \`LLM_BASE_URL\` | Custom endpoint (e.g., AgentRouter) | \`\` |
| \`EMBEDDING_PROVIDER\` | The embedding provider (\`openai\`, \`ollama\`) | \`openai\` |
| \`EMBEDDING_MODEL\` | The embedding model to use | \`text-embedding-3-small\` |
| \`EMBEDDING_API_KEY\` | Your API key for embeddings | Uses \`LLM_API_KEY\` if unset |
| \`DATA_DIR\` | Path to store files and wiki | \`./data\` |
| \`COMPANY_NAME\` | Your company name | \`Our Company\` |

## Directory Structure

- \`src/app/\`: Next.js pages and API routes
- \`src/lib/ingestion/\`: Pipeline for saving, extracting, and chunking files
- \`src/lib/extraction/\`: LLM prompts and Zod schemas for structured extraction
- \`src/lib/wiki/\`: Logic for generating and updating Markdown wiki pages
- \`src/lib/query/\`: RAG engine for answering questions with citations
- \`src/lib/db/\`: SQLite schema and client
- \`data/\`: Where your files and DB are stored locally
- \`seed/\`: Fake data for demonstration purposes

## Future Roadmap

- Authentication and Role-Based Access Control (RBAC)
- Multi-tenancy (Organizations/Workspaces)
- Asynchronous background job queue (e.g., BullMQ)
- Postgres + pgvector migration path for scale
- Real-time integrations (Slack, Zendesk, Gong)
