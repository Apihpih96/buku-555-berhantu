/**
 * @file mcp/debts.js
 * Tool definitions and handlers for the Buku 555 MCP server.
 * Uses the app's own ledger functions and data format (see exportJSON in ledger.js).
 */

import { createEntry, markPaid, totalOutstanding } from '../ledger.js';

const DAY_MS = 86_400_000;

/** Thrown for user-facing problems; becomes an MCP tool error. */
export class ToolError extends Error {}

export const TOOLS = [
  {
    name: 'list_debts',
    description: 'List all debts in the Buku 555 book, with the total outstanding in RM.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['all', 'unpaid', 'paid'], description: 'Filter by status. Default: all.' },
      },
    },
  },
  {
    name: 'add_debt',
    description: 'Add a new unpaid debt to the book.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Customer name, e.g. "Kak Ros".' },
        item: { type: 'string', description: 'What was taken on credit, e.g. "beras 5kg".' },
        amount: { type: 'number', description: 'Amount owed in RM (must be > 0).' },
      },
      required: ['name', 'item', 'amount'],
    },
  },
  {
    name: 'mark_debt_paid',
    description: 'Mark a debt as paid, by its id (see list_debts).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Debt id.' } },
      required: ['id'],
    },
  },
  {
    name: 'list_overdue_debts',
    description: 'List unpaid debts that were written in the book more than N days ago (default 7).',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Age threshold in days. Default: 7.' },
      },
    },
  },
];

/**
 * @typedef {{ load(): object, save(data: object): void }} Store
 */

/** Read the book from the store, normalising shape. */
function readBook(store) {
  const data = store.load();
  const entries = Array.isArray(data) ? data : Array.isArray(data.entries) ? data.entries : [];
  const base = Array.isArray(data) ? {} : data;
  return { base, entries };
}

/** Write the book back, preserving phones / other top-level fields. */
function writeBook(store, base, entries) {
  store.save({ version: 1, phones: {}, ...base, entries });
}

function ageDays(entry, now) {
  return Math.floor((now.getTime() - new Date(entry.createdAt).getTime()) / DAY_MS);
}

/**
 * Run a tool.
 *
 * @param {string} name
 * @param {object} args
 * @param {Store}  store
 * @param {Date}   [now]
 * @returns {object} JSON-serialisable result
 */
export function callTool(name, args = {}, store, now = new Date()) {
  switch (name) {
    case 'list_debts': {
      const status = args.status ?? 'all';
      if (!['all', 'unpaid', 'paid'].includes(status)) {
        throw new ToolError(`status must be one of all, unpaid, paid (got "${status}")`);
      }
      const { entries } = readBook(store);
      const shown = entries.filter(e => status === 'all' || (status === 'paid') === Boolean(e.paid));
      return { count: shown.length, totalOutstandingRM: totalOutstanding(entries), debts: shown };
    }

    case 'add_debt': {
      const customer = typeof args.name === 'string' ? args.name.trim() : '';
      const item = typeof args.item === 'string' ? args.item.trim() : '';
      const amount = args.amount;
      if (!customer) throw new ToolError('name is required');
      if (!item) throw new ToolError('item is required');
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        throw new ToolError('amount must be a number greater than 0');
      }
      const entry = createEntry({
        customer,
        item,
        qty: null,
        amountRM: amount,
        dueDate: null,
        raw: `${customer} ${item} RM${amount} (via MCP)`,
        createdAt: now.toISOString(),
      });
      const { base, entries } = readBook(store);
      writeBook(store, base, [...entries, entry]);
      return { added: entry };
    }

    case 'mark_debt_paid': {
      if (typeof args.id !== 'string' || !args.id) throw new ToolError('id is required');
      const { base, entries } = readBook(store);
      const existing = entries.find(e => e.id === args.id);
      if (!existing) throw new ToolError(`No debt found with id "${args.id}"`);
      if (existing.paid) return { alreadyPaid: true, debt: existing };
      const updated = markPaid(entries, args.id);
      writeBook(store, base, updated);
      return { debt: updated.find(e => e.id === args.id) };
    }

    case 'list_overdue_debts': {
      const days = args.days ?? 7;
      if (typeof days !== 'number' || !Number.isFinite(days) || days < 0) {
        throw new ToolError('days must be a non-negative number');
      }
      const { entries } = readBook(store);
      const cutoff = now.getTime() - days * DAY_MS;
      const overdue = entries
        .filter(e => !e.paid && new Date(e.createdAt).getTime() < cutoff)
        .map(e => ({ ...e, ageDays: ageDays(e, now) }))
        .sort((a, b) => b.ageDays - a.ageDays);
      return {
        thresholdDays: days,
        count: overdue.length,
        totalRM: overdue.reduce((s, e) => s + e.amountRM, 0),
        debts: overdue,
      };
    }

    default:
      throw new ToolError(`Unknown tool: ${name}`);
  }
}
