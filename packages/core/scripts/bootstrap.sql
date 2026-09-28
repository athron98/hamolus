--
-- Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
--
-- Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
--
-- SPDX-License-Identifier: MIT
--
-- Licensed under the MIT License. See the LICENSE file at the repository root.

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