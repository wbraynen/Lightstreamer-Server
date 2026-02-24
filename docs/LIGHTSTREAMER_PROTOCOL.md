# Mock Lightstreamer Server — TLCP Reference

**SDK Target:** Lightstreamer-lib-client-swift 6.1.0
https://github.com/Lightstreamer/Lightstreamer-lib-client-swift/releases/tag/6.1.0

---

## Overview

A local Node.js server that speaks the Lightstreamer TLCP (Text-based Lightstreamer Client Protocol), allowing the iOS app to connect during development without a live Lightstreamer subscription.

---

## Protocol Channels

TLCP uses two logical channels over a single WebSocket connection:

1. **Control Channel** – Request/response acknowledgements (`REQOK`, `REQERR`)
2. **Stream Channel** – Subscription confirmations and data updates (`SUBOK`, `U`, `PROBE`)

---

## Transport Priority

The Lightstreamer iOS SDK automatically negotiates the best available transport:

1. **WS-STREAMING** (WebSocket) – lowest latency, full duplex
2. **HTTP-STREAMING** – long-lived HTTP connection
3. **HTTP-POLLING** – repeated short HTTP requests

The mock server implements **all three** transports.

| Transport | Endpoint |
|-----------|----------|
| WS-STREAMING | `ws://localhost:3001/lightstreamer` |
| HTTP-STREAMING | `POST /lightstreamer/create_session` |
| HTTP-POLLING | `POST /lightstreamer/create_session?LS_polling=true` |

---

## WebSocket Connection Flow

1. Client connects to `ws://localhost:3001/lightstreamer`
2. Client sends `wsok`; server responds `WSOK\r\n`
3. Client sends `create_session\r\n<params>`
4. Server responds with `CONOK`
5. Client sends `control\r\n<params>` with `LS_op=add`
6. Server responds with `REQOK`, then `SUBOK`
7. Server sends initial snapshot (`U`)
8. Server sends streaming updates (`U`) every 1 second
9. Server sends keepalive (`PROBE`) every 5 seconds

---

## Key Architecture Points

- Each WebSocket connection maintains its own subscription namespace
- SubIds are scoped per connection
- Updates are sent only to the owning connection
- Field counts must match between `SUBOK` and `U` messages

---

## Happy Path Example (Wire Protocol)

### Connection 1: Account Subscription

```
Client → ws://localhost:3001/lightstreamer

Client: wsok
Server: WSOK\r\n

Client: create_session\r\n
        LS_adapter_set=DEFAULT&LS_cid=<clientId>&LS_user=<user>
Server: CONOK,MOCK_SESSION_1_1234567890,50000000,5000,*\r\n

Client: control\r\n
        LS_reqId=1&LS_op=add&LS_subId=1&LS_mode=MERGE&LS_group=ACC:<ACCOUNT_ID>&LS_schema=account_id balance equity margin available_margin unrealized_pnl realized_pnl status
Server: REQOK,1\r\n
        SUBOK,1,1,8\r\n
        U,1,1,<8 values>\r\n
```

### Connection 2: Stock Subscriptions

```
Client: control\r\n
        LS_reqId=1&LS_op=add&LS_subId=1&LS_mode=MERGE&LS_group=STOCK:AAPL&LS_schema=stock_name last_price ask bid …
Server: REQOK,1\r\n
        SUBOK,1,1,59\r\n
        U,1,1,<59 values>\r\n
```

---

## Streaming Updates

Every 1 second per active subscription:
```
U,1,1,<updated values>\r\n
U,2,1,<updated values>\r\n
```

`$` means unchanged from previous value (not currently used by the mock — full values are always sent).

---

## Message Format

### Client → Server

```
wsok

create_session\r\n
LS_adapter_set=DEFAULT&LS_cid=<clientId>&LS_user=<user>&LS_password=<token>

control\r\n
LS_reqId=<n>&LS_op=add&LS_subId=<n>&LS_mode=MERGE&LS_group=<group>&LS_schema=<space-separated fields>
```

### Server → Client

```
WSOK\r\n
CONOK,<sessionId>,<requestLimit>,<keepaliveMs>,<controlLink>\r\n
REQOK,<reqId>\r\n
SUBOK,<subId>,<nItems>,<nFields>\r\n
U,<subId>,<itemIdx>,<value1>|<value2>|<value3>\r\n
EOS,<subId>,<itemIdx>\r\n   ← NOT sent in MERGE mode
PROBE\r\n
```

---

## Subscription Groups

Field count is derived from `LS_schema` if provided; otherwise defaults below apply.

### `ACC:<accountId>` — 8 fields

| # | Field |
|---|-------|
| 1 | account_id |
| 2 | balance |
| 3 | equity |
| 4 | margin |
| 5 | available_margin |
| 6 | unrealized_pnl |
| 7 | realized_pnl |
| 8 | status |

Account values fluctuate around ~$9k–$10k balance.

### `STOCK:<ticker>` — 59 fields

| # | Field | # | Field |
|---|-------|---|-------|
| 1 | stock_name | 31 | macd_hist |
| 2 | last_price | 32 | bb_upper |
| 3 | ask | 33 | bb_lower |
| 4 | bid | 34 | bb_mid |
| 5 | change | 35 | sector |
| 6 | pct_change | 36 | industry |
| 7 | volume | 37 | exchange |
| 8 | bid_size | 38 | currency |
| 9 | ask_size | 39 | timestamp |
| 10 | open | 40 | status |
| 11 | day_high | 41 | halted |
| 12 | day_low | 42 | spread |
| 13 | prev_close | 43 | spread_pct |
| 14 | 52w_high | 44 | pre_market_price |
| 15 | 52w_low | 45 | pre_market_change |
| 16 | market_cap | 46 | pre_market_pct |
| 17 | pe_ratio | 47 | pre_market_volume |
| 18 | eps | 48 | after_price |
| 19 | dividend_yield | 49 | after_change |
| 20 | beta | 50 | after_pct |
| 21 | iv | 51 | after_volume |
| 22 | avg_volume | 52 | delta |
| 23 | ma_5 | 53 | gamma |
| 24 | ma_10 | 54 | theta |
| 25 | ma_20 | 55 | vega |
| 26 | ma_50 | 56 | rho |
| 27 | ma_200 | 57 | open_interest |
| 28 | rsi | 58 | notional |
| 29 | macd | 59 | unix_ts |
| 30 | macd_signal | | |

Prices fluctuate ±$1 around a fixed base price each second.

---

## Mock Tickers

AAPL, AMD, TSLA, HD, META, GOOGL, MSFT, NVDA, AMZN, JPM, V, JNJ, WMT, PG, DIS, NFLX, INTC, BA, GS, CAT

---

## Subscription Modes

- **MERGE** — only changed fields sent (mock always sends all fields)
- **DISTINCT** — every update is a distinct event
- **RAW** — unfiltered stream
- **COMMAND** — add/update/delete item lifecycle

---

## Testing

```bash
npm install
npm start                # start server on :3001

npm test                 # SDK integration test (self-contained — starts/stops server)
node test-websocket.js   # raw WebSocket smoke test (requires server already running)
```

`npm test` uses the official `lightstreamer-client-node` SDK and asserts:
- Transport negotiates to `CONNECTED:WS-STREAMING`
- Account subscription (8 fields) confirmed and streaming
- Stock subscription (59 fields) confirmed and streaming
- Two simultaneous subscriptions on one connection both receive updates

---

## Common Gotchas

### Zombie Subscriptions

Do NOT send EOS in MERGE mode.

Wrong:
```
SUBOK
U
EOS
```

Correct:
```
SUBOK
U
```

### Field Count Mismatch

- `SUBOK` field count and `U` field count must be identical
- Track subscriptions per WebSocket connection, not globally

---

## Common Mistakes Checklist

- Sending REQOK after SUBOK (must be before)
- Sending EOS after snapshot in MERGE mode
- Missing PROBE keepalive
- Wrong field counts between SUBOK and U
- Missing `\r\n` terminators
- Global subscription tracking (must be per-connection)
- Not responding to `wsok` before session creation

---

## Protocol Gaps Discovered via SDK Testing

The following behaviors were absent from the original spec but required by the real `lightstreamer-client-node` SDK (v9.2) and corrected in the implementation.

### 1. WSOK Handshake

The SDK sends a bare `wsok` frame immediately after the WebSocket connection opens, before `create_session`. The server must respond with `WSOK\r\n` or the SDK stalls at CONNECTING indefinitely.

### 2. Batched Control Frames

When multiple subscriptions are active at connect time, the SDK packs them into a single WebSocket frame as consecutive param lines under one `control` verb — not as separate frames:

```
control\r\n
LS_reqId=1&LS_op=add&LS_subId=1&LS_group=STOCK%3AAAPL&…\r\n
LS_reqId=2&LS_op=add&LS_subId=2&LS_group=STOCK%3ATSLA&…
```

Each param line is an independent request. A parser that only reads one param line per verb silently drops all but the first subscription.
