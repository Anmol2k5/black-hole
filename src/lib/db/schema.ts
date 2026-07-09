/**
 * SQLite database schema and migrations for Company Brain OS.
 * Uses better-sqlite3 with FTS5 for full-text search.
 */

export const SCHEMA_SQL = `
-- Sources: uploaded raw files
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'default',
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,           -- txt, md, pdf, csv, docx, json
  source_type TEXT DEFAULT 'unknown', -- customer_call, meeting_notes, support_ticket, etc.
  category TEXT DEFAULT 'docs',       -- calls, support, sales, docs, meetings
  file_size INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, extracting, analyzing, compiling, completed, failed
  error TEXT,
  title TEXT,
  extracted_text TEXT,
  metadata_json TEXT,                 -- JSON: people, companies, topics, sentiment, etc.
  summary TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Text chunks with embeddings
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'default',
  source_id TEXT NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  char_start INTEGER DEFAULT 0,
  char_end INTEGER DEFAULT 0,
  embedding_json TEXT,               -- JSON array of floats
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- LLM extraction results per source
CREATE TABLE IF NOT EXISTS extractions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'default',
  source_id TEXT NOT NULL UNIQUE,
  extraction_json TEXT NOT NULL,      -- Full structured extraction
  extracted_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- Generated wiki pages
CREATE TABLE IF NOT EXISTS wiki_pages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'default',
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,             -- product, sales, support, strategy, synthesis, customers
  content_md TEXT NOT NULL DEFAULT '',
  sources_json TEXT DEFAULT '[]',     -- JSON array of source IDs
  source_count INTEGER DEFAULT 0,
  confidence TEXT DEFAULT 'low',      -- low, medium, high
  is_generated INTEGER DEFAULT 1,     -- 1 = auto-generated, 0 = user-created
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Citations linking wiki claims to source chunks
CREATE TABLE IF NOT EXISTS citations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'default',
  wiki_page_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  chunk_id TEXT,
  claim_text TEXT NOT NULL,
  quote TEXT,
  source_title TEXT,
  source_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (wiki_page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- Ingestion jobs
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'default',
  source_id TEXT,
  job_type TEXT NOT NULL DEFAULT 'ingest', -- ingest, recompile, query
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed
  current_step TEXT,
  total_steps INTEGER DEFAULT 0,
  completed_steps INTEGER DEFAULT 0,
  error TEXT,
  result_json TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Saved Q&A answers
CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'default',
  question TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  evidence_json TEXT,                 -- JSON array of evidence items
  confidence TEXT DEFAULT 'low',
  gaps TEXT,
  suggested_action TEXT,
  sources_used_json TEXT,
  saved_to_wiki INTEGER DEFAULT 0,
  wiki_page_slug TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Full-text search on wiki pages
CREATE VIRTUAL TABLE IF NOT EXISTS wiki_pages_fts USING fts5(
  slug,
  title,
  content_md,
  content='wiki_pages',
  content_rowid='rowid'
);

-- FTS triggers for wiki_pages
CREATE TRIGGER IF NOT EXISTS wiki_pages_ai AFTER INSERT ON wiki_pages BEGIN
  INSERT INTO wiki_pages_fts(rowid, slug, title, content_md)
  VALUES (new.rowid, new.slug, new.title, new.content_md);
END;

CREATE TRIGGER IF NOT EXISTS wiki_pages_ad AFTER DELETE ON wiki_pages BEGIN
  INSERT INTO wiki_pages_fts(wiki_pages_fts, rowid, slug, title, content_md)
  VALUES ('delete', old.rowid, old.slug, old.title, old.content_md);
END;

CREATE TRIGGER IF NOT EXISTS wiki_pages_au AFTER UPDATE ON wiki_pages BEGIN
  INSERT INTO wiki_pages_fts(wiki_pages_fts, rowid, slug, title, content_md)
  VALUES ('delete', old.rowid, old.slug, old.title, old.content_md);
  INSERT INTO wiki_pages_fts(rowid, slug, title, content_md)
  VALUES (new.rowid, new.slug, new.title, new.content_md);
END;

-- Full-text search on chunks
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  content='chunks',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
  INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
END;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(status);
CREATE INDEX IF NOT EXISTS idx_sources_org ON sources(org_id);
CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_citations_wiki ON citations(wiki_page_id);
CREATE INDEX IF NOT EXISTS idx_citations_source ON citations(source_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_category ON wiki_pages(category);
`;
