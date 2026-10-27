'use strict';
const fs = require('node:fs');
const path = require('node:path');

function postgresAdapter(connection, transaction) {
  const query = (sql, values = []) => {
    let index = 0;
    return connection.query(sql.replace(/\?/g, () => '$' + (++index)), values);
  };
  return {
    dialect: 'postgres',
    prepare(sql) {
      return {
        async get(...values) { return (await query(sql, values)).rows[0]; },
        async all(...values) { return (await query(sql, values)).rows; },
        async run(...values) { return query(sql, values); }
      };
    },
    async exec(sql) { return connection.exec ? connection.exec(sql) : connection.query(sql); },
    transaction
  };
}

async function openStorage(options) {
  if (options.storage) return options.storage;
  const databaseURL = options.databaseURL || process.env.DATABASE_URL;
  if (databaseURL) {
    const { Pool } = require('pg');
    let url;
    try { url = new URL(databaseURL); } catch (_) { throw new Error('DATABASE_URL is not a valid PostgreSQL URL'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL');
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
    const unencryptedLocal = local && url.searchParams.get('sslmode') === 'disable';
    // Explicitly verify certificates; pg connection-string SSL options must not override this.
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
    const pool = new Pool({ connectionString: url.href, ssl: unencryptedLocal ? false : { rejectUnauthorized: true }, max: 3, idleTimeoutMillis: 1000, connectionTimeoutMillis: 15000 });
    pool.on('error', () => console.error('PostgreSQL connection interrupted; the next request will reconnect.'));
    const adapter = postgresAdapter(pool, async callback => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(postgresAdapter(client));
        await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
      finally { client.release(); }
    });
    adapter.close = () => pool.end();
    return adapter;
  }
  if (process.env.RENDER || process.env.FLEET_REQUIRE_POSTGRES === 'true') {
    throw new Error('DATABASE_URL is required for cloud hosting. Refusing to store trial records on an ephemeral disk.');
  }
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(options.directory, { recursive: true });
  const sqlite = new DatabaseSync(path.join(options.directory, 'fleet.sqlite'));
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  let queue = Promise.resolve();
  const adapter = {
    dialect: 'sqlite',
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { async get(...values) { return statement.get(...values); }, async all(...values) { return statement.all(...values); }, async run(...values) { return statement.run(...values); } };
    },
    async exec(sql) { sqlite.exec(sql); },
    async transaction(callback) {
      const previous = queue;
      let release; queue = new Promise(resolve => { release = resolve; });
      await previous;
      try {
        sqlite.exec('BEGIN IMMEDIATE');
        try { const result = await callback(adapter); sqlite.exec('COMMIT'); return result; }
        catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      } finally { release(); }
    },
    async close() { await queue; sqlite.close(); }
  };
  return adapter;
}
module.exports = { openStorage, postgresAdapter };
