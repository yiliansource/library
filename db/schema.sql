DROP TABLE IF EXISTS files;

CREATE TABLE files (
    file_id TEXT PRIMARY KEY,
    display_name TEXT,
    description TEXT,
    tags TEXT,
    file_name TEXT NOT NULL UNIQUE,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    wip NUMBER,
    password_hash TEXT
);