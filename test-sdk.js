'use strict';

// Integration test using the official Lightstreamer Node.js Client SDK.
// Starts the mock server as a child process, runs assertions, then exits.
// Usage: node test-sdk.js

const { spawn }  = require('child_process');
const path       = require('path');
const ls         = require('lightstreamer-client-node');

const SERVER  = 'http://localhost:3001';
const ADAPTER = 'DEFAULT';

// ─── Assertions ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    failed++;
  }
}

// ─── Test helper ─────────────────────────────────────────────────────────────

function testSubscription(label, item, fields, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const client = new ls.LightstreamerClient(SERVER, ADAPTER);

    let status        = '';
    let subscribed    = false;
    let updateCount   = 0;
    let firstValues   = null;

    client.addListener({
      onStatusChange(s) {
        status = s;
        console.log(`  [${label}] status: ${s}`);
      },
    });

    const sub = new ls.Subscription('MERGE', [item], fields);
    sub.setRequestedSnapshot('yes');

    sub.addListener({
      onSubscription() {
        subscribed = true;
      },
      onSubscriptionError(code, msg) {
        console.error(`  [${label}] subscription error ${code}: ${msg}`);
      },
      onItemUpdate(update) {
        updateCount++;
        if (!firstValues) {
          firstValues = {};
          for (const f of fields) firstValues[f] = update.getValue(f);
        }
      },
    });

    client.subscribe(sub);
    client.connect();

    setTimeout(() => {
      client.disconnect();

      assert(status.startsWith('CONNECTED:'), `${label}: connected (${status})`);
      assert(status.includes('WS-STREAMING'),  `${label}: transport is WS-STREAMING`);
      assert(subscribed,                        `${label}: subscription confirmed (SUBOK)`);
      assert(updateCount > 0,                   `${label}: received ≥1 update (got ${updateCount})`);

      if (firstValues) {
        const sample = fields.slice(0, 3).map(f => `${f}=${firstValues[f]}`).join(', ');
        console.log(`  [${label}] sample values: ${sample}`);
        assert(
          fields.every(f => firstValues[f] !== null && firstValues[f] !== undefined),
          `${label}: all ${fields.length} fields present`
        );
      }

      resolve();
    }, timeoutMs);
  });
}

// ─── Server bootstrap ─────────────────────────────────────────────────────────

function killPort(port) {
  return new Promise((resolve) => {
    const lsof = spawn('lsof', ['-ti', `:${port}`], { stdio: ['ignore', 'pipe', 'ignore'] });
    let pids = '';
    lsof.stdout.on('data', d => { pids += d; });
    lsof.on('close', () => {
      const list = pids.trim().split('\n').filter(Boolean);
      if (list.length === 0) return resolve();
      const killer = spawn('kill', ['-9', ...list], { stdio: 'ignore' });
      killer.on('close', () => setTimeout(resolve, 100));
    });
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [path.join(__dirname, 'server.js')], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (data) => {
      const line = data.toString().trim();
      console.log(`  [server] ${line}`);
      if (line.includes('3001')) resolve(proc);
    });

    proc.stderr.on('data', (data) => {
      console.error(`  [server] ${data.toString().trim()}`);
    });

    proc.on('error', reject);

    // Fallback: resolve after 1 s even if output is unexpected
    setTimeout(() => resolve(proc), 1000);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Clearing port 3001…');
  await killPort(3001);
  console.log('Starting mock server…');
  const server = await startServer();

  // Brief pause to ensure server is fully listening
  await new Promise(r => setTimeout(r, 200));

  try {
    console.log('\n── Account subscription (8 fields) ──');
    await testSubscription(
      'Account',
      'ACC:U001',
      ['account_id', 'balance', 'equity', 'margin', 'available_margin',
       'unrealized_pnl', 'realized_pnl', 'status']
    );

    console.log('\n── Stock subscription — AAPL (59 fields) ──');
    await testSubscription(
      'AAPL',
      'STOCK:AAPL',
      ['stock_name', 'last_price', 'ask', 'bid', 'change', 'pct_change',
       'volume', 'bid_size', 'ask_size', 'open', 'day_high', 'day_low',
       'prev_close', '52w_high', '52w_low', 'market_cap', 'pe_ratio',
       'eps', 'dividend_yield', 'beta', 'iv', 'avg_volume', 'ma_5',
       'ma_10', 'ma_20', 'ma_50', 'ma_200', 'rsi', 'macd', 'macd_signal',
       'macd_hist', 'bb_upper', 'bb_lower', 'bb_mid', 'sector', 'industry',
       'exchange', 'currency', 'timestamp', 'status', 'halted', 'spread',
       'spread_pct', 'pre_market_price', 'pre_market_change', 'pre_market_pct',
       'pre_market_volume', 'after_price', 'after_change', 'after_pct',
       'after_volume', 'delta', 'gamma', 'theta', 'vega', 'rho',
       'open_interest', 'notional', 'unix_ts']
    );

    console.log('\n── Multi-subscription — two stocks on one connection ──');
    await (async () => {
      const client = new ls.LightstreamerClient(SERVER, ADAPTER);
      const fields = ['stock_name', 'last_price', 'pct_change'];
      let aaplUpdates = 0;
      let tslaUpdates = 0;

      client.addListener({
        onStatusChange(s) { console.log(`  [Multi] status: ${s}`); },
      });

      for (const [item] of [['STOCK:AAPL'], ['STOCK:TSLA']]) {
        const sub = new ls.Subscription('MERGE', [item], fields);
        sub.setRequestedSnapshot('yes');
        sub.addListener({
          onSubscription()          { console.log(`  [Multi] subscribed: ${item}`); },
          onSubscriptionError(c, m) { console.error(`  [Multi] sub error ${c} ${m} (${item})`); },
          onItemUpdate()            {
            if (item.includes('AAPL')) aaplUpdates++;
            else                       tslaUpdates++;
          },
        });
        client.subscribe(sub);
      }

      client.connect();
      await new Promise(r => setTimeout(r, 3000));
      client.disconnect();

      assert(aaplUpdates > 0, `Multi-sub: AAPL received ${aaplUpdates} update(s)`);
      assert(tslaUpdates > 0, `Multi-sub: TSLA received ${tslaUpdates} update(s)`);
    })();

  } finally {
    server.kill();

    console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
