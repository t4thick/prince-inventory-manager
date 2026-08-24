# Prince Auto

Inventory + checkout for Prince's mechanic shop.

## Run

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

## What it does

- **Checkout** — add parts & labor to a job ticket, take cash/card/transfer (parts count drops automatically)
- **Parts** — add parts and labor rates, edit prices, +/- on-hand quantity, low-stock alerts
- **Jobs** — today's closed jobs and earlier history

Data stays in the browser (`localStorage`) for now.
