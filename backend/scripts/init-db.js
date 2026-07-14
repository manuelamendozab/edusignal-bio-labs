const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');

if (!fs.existsSync(schemaPath)) {
  console.error(`Schema file not found: ${schemaPath}`);
  process.exit(1);
}

const schemaSql = fs.readFileSync(schemaPath, 'utf8');
const db = new Database(dbPath);

try {
  db.pragma('foreign_keys = ON');
  db.exec(schemaSql);
  console.log(`SQLite database initialized at ${dbPath}`);
} catch (error) {
  console.error('Failed to initialize SQLite database:', error);
  process.exit(1);
} finally {
  db.close();
}
