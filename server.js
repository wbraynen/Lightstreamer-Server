'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const { URLSearchParams } = require('url');

const PORT = 3001;

// ─── Mock Data ────────────────────────────────────────────────────────────────

const BASE_PRICES = {
  AAPL: 185.50, AMD: 145.20,  TSLA: 245.80, HD:   342.10, META:  478.30,
  GOOGL: 155.40, MSFT: 415.60, NVDA: 875.20, AMZN: 185.90, JPM:  195.40,
  V:    278.50, JNJ:  158.20,  WMT:  172.30, PG:   168.40, DIS:  112.50,
  NFLX: 625.80, INTC:  42.30,  BA:   195.60, GS:   458.70, CAT:  312.40,
};

// 59-field stock snapshot
function stockValues(ticker) {
  const base  = BASE_PRICES[ticker] || 100;
  const price = +(base + (Math.random() - 0.5) * 2).toFixed(2);
  const change = +(price - base).toFixed(2);
  const pct    = +((change / base) * 100).toFixed(2);
  const ask    = +(price + 0.05).toFixed(2);
  const bid    = +(price - 0.05).toFixed(2);
  const vol    = Math.floor(Math.random() * 1_000_000 + 100_000);
  const now    = new Date();

  return [
    ticker,                                                      //  1 stock_name
    price,                                                       //  2 last_price
    ask,                                                         //  3 ask
    bid,                                                         //  4 bid
    change,                                                      //  5 change
    pct,                                                         //  6 pct_change
    vol,                                                         //  7 volume
    Math.floor(Math.random() * 200 + 1),                         //  8 bid_size
    Math.floor(Math.random() * 200 + 1),                         //  9 ask_size
    +(base * 0.99).toFixed(2),                                   // 10 open
    +(base * 1.04).toFixed(2),                                   // 11 day_high
    +(base * 0.96).toFixed(2),                                   // 12 day_low
    +(base * 0.995).toFixed(2),                                  // 13 prev_close
    +(base * 1.50).toFixed(2),                                   // 14 52w_high
    +(base * 0.65).toFixed(2),                                   // 15 52w_low
    Math.floor(base * 8_000_000_000),                            // 16 market_cap
    +(Math.random() * 15 + 12).toFixed(2),                       // 17 pe_ratio
    +(Math.random() * 5  +  1).toFixed(2),                       // 18 eps
    +(Math.random() * 2  + 0.3).toFixed(2),                      // 19 dividend_yield
    +(Math.random() * 0.5 + 0.8).toFixed(2),                     // 20 beta
    +(Math.random() * 30 + 15).toFixed(2),                       // 21 iv
    Math.floor(Math.random() * 5_000_000 + 1_000_000),           // 22 avg_volume
    +(price * 1.001).toFixed(2),                                 // 23 ma_5
    +(price * 0.999).toFixed(2),                                 // 24 ma_10
    +(price * 0.997).toFixed(2),                                 // 25 ma_20
    +(price * 0.990).toFixed(2),                                 // 26 ma_50
    +(price * 0.920).toFixed(2),                                 // 27 ma_200
    +(40 + Math.random() * 30).toFixed(2),                       // 28 rsi
    +(Math.random() * 2   - 1).toFixed(3),                       // 29 macd
    +(Math.random() * 1   - 0.5).toFixed(3),                     // 30 macd_signal
    +(Math.random() * 0.5 - 0.25).toFixed(3),                    // 31 macd_hist
    +(price * 1.02).toFixed(2),                                  // 32 bb_upper
    +(price * 0.98).toFixed(2),                                  // 33 bb_lower
    price,                                                       // 34 bb_mid
    'Technology',                                                // 35 sector
    'Consumer Electronics',                                      // 36 industry
    'NASDAQ',                                                    // 37 exchange
    'USD',                                                       // 38 currency
    now.toISOString().replace('T', ' ').slice(0, 19),            // 39 timestamp
    'ACTIVE',                                                    // 40 status
    'false',                                                     // 41 halted
    '0.10',                                                      // 42 spread
    +((0.10 / price) * 100).toFixed(4),                          // 43 spread_pct
    +(price * 1.003).toFixed(2),                                 // 44 pre_market_price
    +(price * 0.003).toFixed(2),                                 // 45 pre_market_change
    '0.30',                                                      // 46 pre_market_pct
    Math.floor(Math.random() * 50_000),                          // 47 pre_market_volume
    +(price * 0.997).toFixed(2),                                 // 48 after_price
    +(-price * 0.003).toFixed(2),                                // 49 after_change
    '-0.30',                                                     // 50 after_pct
    Math.floor(Math.random() * 30_000),                          // 51 after_volume
    +(Math.random() * 0.8 + 0.1).toFixed(4),                     // 52 delta
    +(Math.random() * 0.01).toFixed(6),                          // 53 gamma
    +(-Math.random() * 0.05).toFixed(4),                         // 54 theta
    +(Math.random() * 0.1).toFixed(4),                           // 55 vega
    +(Math.random() * 0.02).toFixed(4),                          // 56 rho
    Math.floor(Math.random() * 10_000),                          // 57 open_interest
    Math.floor(Math.random() * 5_000_000),                       // 58 notional
    now.getTime(),                                               // 59 unix_ts
  ];
}

// 8-field account snapshot
function accountValues(accountId) {
  const balance    = +(9000 + Math.random() * 1000).toFixed(2);
  const unrealized = +((Math.random() - 0.5) * 500).toFixed(2);
  const realized   = +((Math.random() - 0.5) * 200).toFixed(2);
  const equity     = +(balance + unrealized).toFixed(2);
  const margin     = +(equity * 0.5).toFixed(2);
  const available  = +(equity - margin).toFixed(2);

  return [
    accountId,   //  1 account_id
    balance,     //  2 balance
    equity,      //  3 equity
    margin,      //  4 margin
    available,   //  5 available_margin
    unrealized,  //  6 unrealized_pnl
    realized,    //  7 realized_pnl
    'ACTIVE',    //  8 status
  ];
}

function resolveValues(group, nFields) {
  let vals;
  if      (group.startsWith('ACC:'))   vals = accountValues(group.slice(4));
  else if (group.startsWith('STOCK:')) vals = stockValues(group.slice(6));
  else                                 vals = ['mock'];

  while (vals.length < nFields) vals.push('');
  return vals.slice(0, nFields);
}

// ─── Connection (transport-agnostic) ─────────────────────────────────────────

class Connection {
  constructor(send, onClose = () => {}) {
    this.send      = send;
    this.onClose   = onClose;
    this.sessionId = `MOCK_SESSION_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    this.subs      = new Map();   // subId → { group, nFields }
    this.timers    = new Map();   // subId → intervalId
    this.probe     = null;
    this.closed    = false;
  }

  init() {
    this.send(`CONOK,${this.sessionId},50000000,5000,*\r\n`);
    this.probe = setInterval(() => {
      if (!this.closed) this.send('PROBE\r\n');
    }, 5000);
  }

  control(params) {
    const op    = params.get('LS_op')    || '';
    const reqId = params.get('LS_reqId') || '0';

    if (op === 'add') {
      const subId  = params.get('LS_subId')  || '0';
      const mode   = params.get('LS_mode')   || 'MERGE';
      const group  = params.get('LS_group')  || '';
      const schema = params.get('LS_schema') || '';

      const schemaFields = schema ? schema.split(' ').filter(Boolean) : [];
      let nFields;
      if      (schemaFields.length > 0)     nFields = schemaFields.length;
      else if (group.startsWith('ACC:'))    nFields = 8;
      else if (group.startsWith('STOCK:'))  nFields = 59;
      else                                  nFields = 1;

      this.subs.set(subId, { group, nFields });

      this.send(`REQOK,${reqId}\r\n`);
      this.send(`SUBOK,${subId},1,${nFields}\r\n`);
      this._sendU(subId);  // snapshot

      const id = setInterval(() => {
        if (!this.closed) this._sendU(subId);
      }, 1000);
      this.timers.set(subId, id);

    } else if (op === 'remove') {
      const subId = params.get('LS_subId') || '0';
      this._clearSub(subId);
      this.send(`REQOK,${reqId}\r\n`);

    } else if (op === 'destroy') {
      this.send(`REQOK,${reqId}\r\n`);
      this.close();

    } else {
      // heartbeat / unknown — just ack
      this.send(`REQOK,${reqId}\r\n`);
    }
  }

  _sendU(subId) {
    const sub = this.subs.get(subId);
    if (!sub) return;
    const vals = resolveValues(sub.group, sub.nFields);
    this.send(`U,${subId},1,${vals.join('|')}\r\n`);
  }

  _clearSub(subId) {
    const t = this.timers.get(subId);
    if (t) { clearInterval(t); this.timers.delete(subId); }
    this.subs.delete(subId);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.probe) clearInterval(this.probe);
    for (const t of this.timers.values()) clearInterval(t);
    this.timers.clear();
    this.subs.clear();
    this.onClose();
  }
}

// ─── TLCP Message Parser ──────────────────────────────────────────────────────

// Known single-word verbs; everything else is a param line
const TLCP_VERBS = new Set([
  'wsok', 'create_session', 'bind_session', 'control', 'msg', 'heartbeat',
]);

function parseTLCP(raw) {
  const text  = typeof raw === 'string' ? raw : raw.toString('utf8');
  const lines = text.split('\r\n').map(l => l.trim()).filter(Boolean);
  const messages = [];
  let i = 0;

  while (i < lines.length) {
    const verb = lines[i++];

    if (!TLCP_VERBS.has(verb)) {
      // Unknown single-token message (shouldn't happen, but be safe)
      messages.push({ verb, params: new URLSearchParams('') });
      continue;
    }

    // Collect all consecutive param lines that follow this verb
    const paramLines = [];
    while (i < lines.length && !TLCP_VERBS.has(lines[i])) {
      if (lines[i].includes('=')) paramLines.push(lines[i]);
      i++;
    }

    if (paramLines.length === 0) {
      // Verb with no params (e.g. wsok)
      messages.push({ verb, params: new URLSearchParams('') });
    } else {
      // Each param line is a separate logical request under the same verb
      for (const p of paramLines) {
        messages.push({ verb, params: new URLSearchParams(p) });
      }
    }
  }

  return messages;
}

// ─── HTTP Session Registry ────────────────────────────────────────────────────

const httpSessions = new Map();  // sessionId → Connection

// ─── WebSocket Handler ────────────────────────────────────────────────────────

function handleWebSocket(ws) {
  let conn = null;

  ws.on('message', (data) => {
    const msgs = parseTLCP(data);
    for (const { verb, params } of msgs) {
      if (verb === 'wsok') {
        // TLCP WebSocket handshake — must respond before session creation
        ws.send('WSOK\r\n');
      } else if (verb === 'create_session' || verb === 'bind_session') {
        if (!conn) {
          conn = new Connection(
            (msg) => { if (ws.readyState === ws.OPEN) ws.send(msg); },
            ()    => { ws.close(); }
          );
          conn.init();
        }
      } else if (verb === 'control') {
        if (conn) conn.control(params);
      }
    }
  });

  ws.on('close', () => { if (conn) conn.close(); });
  ws.on('error', () => { if (conn) conn.close(); });
}

// ─── HTTP Handler ─────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function mergeParams(req, body) {
  const url     = new URL(req.url, `http://localhost`);
  const merged  = new URLSearchParams(url.search);
  const ct      = req.headers['content-type'] || '';
  const bodyParams = ct.includes('application/x-www-form-urlencoded') || body.includes('=')
    ? new URLSearchParams(body)
    : new URLSearchParams('');
  for (const [k, v] of bodyParams) merged.set(k, v);
  return merged;
}

const BASE_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-cache',
};

async function handleHTTP(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url      = new URL(req.url, `http://localhost`);
  const pathname = url.pathname.replace(/\.txt$/, '');
  const body     = await readBody(req);
  const params   = mergeParams(req, body);

  // ── create_session ─────────────────────────────────────────────────────────
  if (pathname.endsWith('/create_session')) {
    const polling = params.get('LS_polling') === 'true';

    if (polling) {
      const conn = new Connection(() => {});
      // Disable probe for polling — client drives the rhythm
      if (conn.probe) { clearInterval(conn.probe); conn.probe = null; }
      httpSessions.set(conn.sessionId, conn);
      res.writeHead(200, BASE_HEADERS);
      res.end(`CONOK,${conn.sessionId},50000000,5000,*\r\n`);
    } else {
      // HTTP-Streaming: keep connection open
      res.writeHead(200, { ...BASE_HEADERS, 'Transfer-Encoding': 'chunked' });
      const send = (msg) => { if (!res.writableEnded) res.write(msg); };
      const conn = new Connection(send);
      httpSessions.set(conn.sessionId, conn);
      conn.init();
      req.on('close', () => conn.close());
    }
    return;
  }

  // ── bind_session ───────────────────────────────────────────────────────────
  if (pathname.endsWith('/bind_session')) {
    const sessionId = params.get('LS_session') || '';
    const conn      = httpSessions.get(sessionId);
    if (!conn) {
      res.writeHead(400, BASE_HEADERS);
      res.end('CONERR,2,Unknown session\r\n');
      return;
    }

    const polling = params.get('LS_polling') === 'true';
    if (polling) {
      // Capture outgoing messages for the duration of this poll
      const buf = [];
      const prevSend = conn.send;
      conn.send = (msg) => buf.push(msg);
      await new Promise(r => setTimeout(r, 200));
      conn.send = prevSend;
      res.writeHead(200, BASE_HEADERS);
      res.end(buf.join('') || 'PROBE\r\n');
    } else {
      // Re-attach this response as the streaming sink
      res.writeHead(200, { ...BASE_HEADERS, 'Transfer-Encoding': 'chunked' });
      conn.send = (msg) => { if (!res.writableEnded) res.write(msg); };
      req.on('close', () => { /* session stays alive */ });
    }
    return;
  }

  // ── control ────────────────────────────────────────────────────────────────
  if (pathname.endsWith('/control')) {
    const sessionId = params.get('LS_session') || '';
    const conn      = httpSessions.get(sessionId);
    const reqId     = params.get('LS_reqId') || '0';

    if (!conn) {
      res.writeHead(400, BASE_HEADERS);
      res.end(`REQERR,${reqId},2,Unknown session\r\n`);
      return;
    }

    // Intercept send to split REQOK (→ HTTP response) from stream messages (→ conn)
    const prevSend    = conn.send;
    const httpChunks  = [];
    const streamChunks = [];
    conn.send = (msg) => {
      if (msg.startsWith('REQOK') || msg.startsWith('REQERR')) httpChunks.push(msg);
      else                                                       streamChunks.push(msg);
    };
    conn.control(params);
    conn.send = prevSend;
    for (const msg of streamChunks) prevSend(msg);  // flush to stream

    res.writeHead(200, BASE_HEADERS);
    res.end(httpChunks.join('') || `REQOK,${reqId}\r\n`);
    return;
  }

  // ── health check ───────────────────────────────────────────────────────────
  res.writeHead(200, BASE_HEADERS);
  res.end('Lightstreamer mock server OK\r\n');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  handleHTTP(req, res).catch((err) => {
    console.error('HTTP error:', err);
    if (!res.headersSent) { res.writeHead(500); res.end('Internal error\r\n'); }
  });
});

const wss = new WebSocketServer({ server, path: '/lightstreamer' });
wss.on('connection', handleWebSocket);

server.listen(PORT, () => {
  console.log(`Mock Lightstreamer server on ws://localhost:${PORT}/lightstreamer`);
  console.log(`HTTP transports on http://localhost:${PORT}/lightstreamer/`);
});
