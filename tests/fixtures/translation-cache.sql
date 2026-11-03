-- Persist exact source/target translations shared by rent and rent-web.
CREATE TABLE translation_cache (
  cache_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('deepl', 'google')),
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_text TEXT NOT NULL,
  source_bytes INTEGER NOT NULL CHECK(source_bytes >= 0),
  translated_text TEXT,
  translated_bytes INTEGER NOT NULL DEFAULT 0 CHECK(translated_bytes >= 0),
  lock_token TEXT NOT NULL DEFAULT '',
  lock_until INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE translation_daily_usage (
  usage_date TEXT PRIMARY KEY,
  source_bytes INTEGER NOT NULL DEFAULT 0 CHECK(source_bytes >= 0)
);
