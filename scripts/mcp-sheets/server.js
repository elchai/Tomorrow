#!/usr/bin/env node
/**
 * Tomorrow Sheets MCP — local MCP server exposing Google Sheets read/write
 * tools to Claude Code. One-shot OAuth (see authorize.js), then stdio.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { google } from 'googleapis';
import { loadAuth } from './auth.js';

const auth   = await loadAuth();
const sheets = google.sheets({ version: 'v4', auth });

const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

const server = new McpServer({ name: 'sheets-mcp', version: '0.1.0' });

// ───── READ ─────
server.tool(
  'sheets_read_range',
  'Read cells from a Google Sheets range. Returns a 2-D array of values.',
  {
    spreadsheetId: z.string().describe('Sheet ID from the URL (docs.google.com/spreadsheets/d/<ID>/edit)'),
    range: z.string().describe('A1 notation, e.g. "Sheet1!A1:C100" or just "A1:C100"')
  },
  async ({ spreadsheetId, range }) => {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return ok({ range: res.data.range, values: res.data.values || [] });
  }
);

// ───── APPEND (the main reason for this whole thing) ─────
server.tool(
  'sheets_append_rows',
  'Append rows after the last data row of a table. `values` is a 2-D array (rows × cells).',
  {
    spreadsheetId: z.string(),
    range: z.string().describe('Anchor range, e.g. "Sheet1!A1" — append finds the table end and inserts below it'),
    values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
  },
  async ({ spreadsheetId, range, values }) => {
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId, range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values }
    });
    return ok({ updates: res.data.updates });
  }
);

// ───── UPDATE (overwrite specific cells) ─────
server.tool(
  'sheets_update_range',
  'Overwrite the cells in a specific A1 range with the provided 2-D values.',
  {
    spreadsheetId: z.string(),
    range: z.string(),
    values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
  },
  async ({ spreadsheetId, range, values }) => {
    const res = await sheets.spreadsheets.values.update({
      spreadsheetId, range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });
    return ok({
      updatedRange: res.data.updatedRange,
      updatedRows: res.data.updatedRows,
      updatedColumns: res.data.updatedColumns,
      updatedCells: res.data.updatedCells
    });
  }
);

// ───── METADATA (list tabs) ─────
server.tool(
  'sheets_get_metadata',
  'List the tabs (sheets) inside a spreadsheet — title, id, row/column counts.',
  { spreadsheetId: z.string() },
  async ({ spreadsheetId }) => {
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'spreadsheetId,properties(title),sheets(properties(sheetId,title,gridProperties))'
    });
    return ok({
      title: res.data.properties.title,
      sheets: res.data.sheets.map(s => ({
        id: s.properties.sheetId,
        title: s.properties.title,
        rows: s.properties.gridProperties.rowCount,
        cols: s.properties.gridProperties.columnCount
      }))
    });
  }
);

// ───── BATCH UPDATE (formatting + structural ops) ─────
server.tool(
  'sheets_batch_update',
  'Low-level batchUpdate for formatting / structural changes (insert rows, format cells, freeze headers...). Pass a `requests` array per the Sheets API spec.',
  {
    spreadsheetId: z.string(),
    requests: z.array(z.any())
  },
  async ({ spreadsheetId, requests }) => {
    const res = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    return ok({ replies: res.data.replies });
  }
);

await server.connect(new StdioServerTransport());
