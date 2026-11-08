# Requirements — Buku 555 MCP Server

## Overview
A small Model Context Protocol (MCP) server that lets Kiro read and update a Buku 555 debt book. It uses the same data format as the app's JSON export/import (`{ version: 1, entries: LedgerEntry[], phones }`), so a backup exported from the app can be used directly.

## Requirements

**MCP-1** WHEN a client calls `list_debts`, the server SHALL return every entry in the book (paid and unpaid) plus the total outstanding in RM. It SHALL accept an optional `status` filter (`all` | `unpaid` | `paid`).

**MCP-2** WHEN a client calls `add_debt` with `name`, `item` and `amount`, the server SHALL create a new unpaid entry using `createEntry` from `ledger.js`, persist it, and return the new entry.
- IF `name` or `item` is empty, or `amount` is not a finite number greater than 0, THEN the server SHALL return a tool error and SHALL NOT modify the book.

**MCP-3** WHEN a client calls `mark_debt_paid` with an `id`, the server SHALL mark that entry paid (`paid: true`, `paidAt` set) and persist it.
- IF no entry has that `id`, THEN the server SHALL return a tool error.
- IF the entry is already paid, THEN the server SHALL return it unchanged and say so.

**MCP-4** WHEN a client calls `list_overdue_debts`, the server SHALL return unpaid entries whose `createdAt` is more than 7 days ago. An optional `days` argument SHALL override the 7-day threshold. Each result SHALL include `ageDays`.

**MCP-5** The server SHALL store data in a JSON file at `$BUKU555_DATA`, defaulting to `data/buku555.json` in the project. IF the file does not exist, the server SHALL treat the book as empty and create it on first write.

**MCP-6** The server SHALL preserve `phones` and any other top-level fields when rewriting the file, and SHALL write atomically (temp file + rename).

**MCP-7** The server SHALL have no runtime dependencies (stdio JSON-RPC, Node ≥ 18) and SHALL never write anything but protocol messages to stdout.

**MCP-8** The repo SHALL include a Kiro MCP config (`.kiro/settings/mcp.json`) and a README section explaining how to run the server.
