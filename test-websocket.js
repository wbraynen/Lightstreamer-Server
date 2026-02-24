'use strict';

// Manual smoke test — verifies CONOK, REQOK, SUBOK, U, and PROBE messages.
// Usage: node test-websocket.js
// Expected output: messages from both connections for ~10 seconds, then exit.

const WebSocket = require('ws');

const URL = 'ws://localhost:3001/lightstreamer';
const TIMEOUT_MS = 10_000;

let received = { CONOK: 0, REQOK: 0, SUBOK: 0, U: 0, PROBE: 0 };

function connect(label, onConok) {
  const ws = new WebSocket(URL);

  ws.on('open', () => {
    console.log(`[${label}] connected`);
    ws.send('create_session\r\nLS_adapter_set=DEFAULT&LS_cid=test&LS_user=dev\r\n');
  });

  ws.on('message', (data) => {
    const text = data.toString();
    for (const line of text.split('\r\n').filter(Boolean)) {
      const type = line.split(',')[0];
      if (received[type] !== undefined) received[type]++;
      console.log(`[${label}] << ${line}`);
    }
    if (text.includes('CONOK') && onConok) onConok(ws);
  });

  ws.on('close', () => console.log(`[${label}] disconnected`));
  ws.on('error', (e) => console.error(`[${label}] error:`, e.message));
  return ws;
}

// Connection 1: account subscription
const ws1 = connect('Account', (ws) => {
  ws.send(
    'control\r\n' +
    'LS_reqId=1&LS_op=add&LS_subId=1&LS_mode=MERGE&LS_group=ACC:U001&LS_snapshot=true\r\n'
  );
});

// Connection 2: two stock subscriptions (staggered)
setTimeout(() => {
  const ws2 = connect('Stocks', (ws) => {
    ws.send(
      'control\r\n' +
      'LS_reqId=1&LS_op=add&LS_subId=1&LS_mode=MERGE&LS_group=STOCK:AAPL&LS_snapshot=true\r\n'
    );
    setTimeout(() => {
      ws.send(
        'control\r\n' +
        'LS_reqId=2&LS_op=add&LS_subId=2&LS_mode=MERGE&LS_group=STOCK:TSLA&LS_snapshot=true\r\n'
      );
    }, 500);
  });

  setTimeout(() => {
    ws2.close();
    ws1.close();
    console.log('\n── Summary ──');
    for (const [k, v] of Object.entries(received)) {
      console.log(`  ${k}: ${v}`);
    }
    const ok =
      received.CONOK >= 2 &&
      received.REQOK >= 3 &&
      received.SUBOK >= 3 &&
      received.U     >= 3;
    console.log(ok ? '\n✓ All checks passed' : '\n✗ Some checks failed');
    process.exit(ok ? 0 : 1);
  }, TIMEOUT_MS);
}, 200);
