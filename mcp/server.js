#!/usr/bin/env node
/**
 * @file mcp/server.js
 * Dependency-free MCP server (stdio, newline-delimited JSON-RPC 2.0) for the
 * Buku 555 debt book.
 *
 * Data file: $BUKU555_DATA, default <project>/data/buku555.json
 * (same format as the app's JSON export).
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { TOOLS, ToolError, callTool } from './debts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.resolve(process.env.BUKU555_DATA || path.join(ROOT, 'data', 'buku555.json'));
const SERVER_INFO = { name: 'buku555', version: '1.0.0' };
const DEFAULT_PROTOCOL = '2025-06-18';

/** File-backed store. Missing file = empty book. */
const store = {
  load() {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return { version: 1, entries: [], phones: {} };
      throw new ToolError(`Cannot read ${DATA_FILE}: ${err.message}`);
    }
  },
  save(data) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  },
};

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const log = (...a) => console.error('[buku555-mcp]', ...a);

function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;

  switch (method) {
    case 'initialize':
      return send({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: params?.protocolVersion ?? DEFAULT_PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      });

    case 'ping':
      return send({ jsonrpc: '2.0', id, result: {} });

    case 'tools/list':
      return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });

    case 'tools/call': {
      let result;
      try {
        const data = callTool(params?.name, params?.arguments ?? {}, store);
        result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        if (!(err instanceof ToolError)) log(err);
        result = { isError: true, content: [{ type: 'text', text: err.message }] };
      }
      return send({ jsonrpc: '2.0', id, result });
    }

    default:
      // Notifications (e.g. notifications/initialized) need no reply.
      if (isRequest) {
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
      }
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  try {
    handle(msg);
  } catch (err) {
    log(err);
    if (msg.id !== undefined) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: 'Internal error' } });
    }
  }
});
log(`ready, data file: ${DATA_FILE}`);
