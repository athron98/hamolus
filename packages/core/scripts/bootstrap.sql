-- Bootstrap tabel metadata definisi koleksi (manual, opsional).
-- Runtime juga bikin otomatis (CREATE TABLE IF NOT EXISTS) di meta/store.ts.
CREATE TABLE IF NOT EXISTS _meta_collections (
  name TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  timestamps INTEGER NOT NULL DEFAULT 0,
  soft_delete INTEGER NOT NULL DEFAULT 0,
  primary_key TEXT NOT NULL DEFAULT 'id',
  fields TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);