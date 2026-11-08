# Design — Buku 555 MCP Server

## Architecture

```
Kiro ──stdio JSON-RPC──▶ mcp/server.js ──▶ mcp/debts.js ──▶ ledger.js (createEntry, markPaid, totalOutstanding)
                                                     └──▶ data/buku555.json  (app export format)
```

- `mcp/server.js` — newline-delimited JSON-RPC 2.0 transport. Handles `initialize`, `ping`, `tools/list`, `tools/call`; ignores notifications.
- `mcp/debts.js` — tool definitions and handlers. Exports pure-ish functions taking a `store` (`load()` / `save()`) and a `now` so they can be unit-tested.
- Logging goes to stderr only.

## Data format
Identical to `exportJSON()` in `ledger.js`:

```json
{ "version": 1, "entries": [ { "id": "…", "customer": "Kak Ros", "item": "beras", "qty": null,
  "amountRM": 18.5, "dueDate": null, "paid": false, "paidAt": null,
  "createdAt": "2026-11-01T08:00:00.000Z", "raw": "…" } ], "phones": {} }
```

The tool argument `name` maps to the entry field `customer`; `amount` maps to `amountRM`.

## Tools

| Tool | Input | Result |
|------|-------|--------|
| `list_debts` | `status?` | entries + `totalOutstandingRM` |
| `add_debt` | `name`, `item`, `amount` | created entry |
| `mark_debt_paid` | `id` | updated entry |
| `list_overdue_debts` | `days?` (default 7) | unpaid entries older than `days`, with `ageDays` |

"Older than 7 days" is measured from `createdAt` (when the debt was written in the book). This is separate from the app's `dueDate`-based "overdue".

## Errors
Validation and not-found problems are returned as `{ isError: true, content: [...] }` tool results. Unknown methods return JSON-RPC error `-32601`; malformed JSON returns `-32700`.
