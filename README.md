# MNest UnifiedPOS

One system for a retail business: an **online store** for customers and a **point-of-sale and back-office portal** for staff, sharing the same products, stock, orders and customers. Built for **Ebenezer Unique Ventures** (electronics and home appliances, Accra and Kumasi), and usable by any shop.

## What it does

### Online store
- Product catalogue with illustrations, Shopify-style descriptions, filters, wishlist and quick view.
- Cart with suggestions, checkout (delivery, click & collect, buy in store) and Mobile Money, GhPay, Paystack, bank transfer or pay on delivery.
- Customer accounts: orders, payment history, purchase history, addresses and security.
- PDF documents: Order Confirmation, receipt and invoice.
- Site-wide search that also covers Help & policies.
- A shop assistant chat that answers from the store's own data, with optional AI answers.
- Legal pages (Terms, Privacy, Returns & refunds, Delivery, Cookies) and a cookie consent banner.
- Custom pages created and published from the POS.

### UnifiedPOS portal
- **Sell Now till:**
  - scan with a barcode scanner (USB or Bluetooth) or a tablet / phone camera;
  - parked sales, returns and exchanges;
  - receipts and invoices;
  - works offline.
- **Catalogue:** products, units and variants, barcodes and labels, inventory, stock in by scanning, transfers, purchase orders, stock takes and damages.
- **Sales:** online orders, collections, riders, customers, pro-formas and invoices, hire purchase.
- **Money:** finance, cash-ups, expenses and tax.
- **Reports**, **CRM** and **Approvals**.
- **Grow & team:**
  - marketing;
  - People & HR, with the QR time clock and staff ID cards;
  - payroll with Ghana PAYE and SSNIT.
- **Post to webstore:** discount codes, pages, policies, product descriptions, SEO, delivery charges and store settings.
- **Security and admin:** roles, permissions, MFA / passcodes, Zero Trust checks, audit trail, IT and hardware set-up.

---

## Tech stack

- **Front end:**
  - [Vite](https://vitejs.dev) + React 18 + TypeScript;
  - [Tailwind CSS](https://tailwindcss.com) 3;
  - React Router 6.
- **Server:** serverless functions in [`/api`](api), deployed to [Vercel](https://vercel.com), with Upstash Redis / Vercel KV over REST.
- **Barcodes:** [ZXing](https://github.com/zxing-js) and the browser BarcodeDetector for camera scanning.
- **AI:** the [Anthropic SDK](https://www.npmjs.com/package/@anthropic-ai/sdk) for the shop assistant's optional AI answers (server only).
- **PDFs:** a small built-in PDF writer, with no third-party PDF library.

---

## Getting started

Requires **Node.js 20 or newer** (Node 24 LTS recommended).

```bash
# 1. Install dependencies
npm install

# 2. Add your settings (optional: everything runs without them)
cp .env.example .env      # then fill in the values you need

# 3. Start the development server
npm run dev
```


The serverless functions in `/api` (email, AI chat, shared database, cron) do not run under `npm run dev`. The app notices and falls back gracefully. To run them locally, use the Vercel CLI: `npm i -g vercel` and then `vercel dev`.

Demo accounts and data are for trying the system only. **Change every password and passcode before going live.** The system reminds you with a Zero Trust banner.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server with hot reload |
| `npm run build` | Type-checks (`tsc -b`) and builds the production site into `dist/` |
| `npm run preview` | Serves the production build locally |

Redraw the product illustrations after changing the demo catalogue:

```bash
npx esbuild scripts/productArt.ts --bundle --platform=node --outfile=/tmp/art.cjs && node /tmp/art.cjs
```

## Deploying (Vercel)

1. Push the project to GitHub or GitLab and import it in Vercel. It is detected as a Vite project, with build command `npm run build` and output folder `dist`.
2. Add the environment variables above under **Project → Settings → Environment Variables**.
3. Connect an Upstash Redis database from the Vercel Marketplace if you want the shared barcode register and the server-side 09:00 check.
4. Deploy. The functions in `/api` and the cron job in `vercel.json` are picked up automatically.

`vercel.json` also rewrites every address except `/api/…` to `index.html`. The app's pages (`/pos`, `/pos/sell`, `/product/…`) are drawn in the browser by React Router, so without this rule Vercel answers them with **404 NOT_FOUND** (only `/` would load). Real files such as `/assets/…` and `/manifest.webmanifest` are still served first.

Camera scanning, WebUSB label printing and "install as an app" need **HTTPS**, which Vercel provides.

---

## Project structure

```
api/                   Serverless functions: AI chat, email, background removal, barcodes, time clock, cron
public/assets/         Logos, store hero art and product illustrations (assets/products/<id>.svg)
scripts/productArt.ts  Draws the product illustrations from the catalogue
src/
  main.tsx             Entry point: chooses the online store (/) or the POS portal (/pos); one-time data migrations
  App.tsx              POS portal routes
  StoreSite.tsx        Online store entry
  components/          Shared UI: layout, top bar, tabs, camera scanner, description editor …
  data/                Demo data and models: catalogue, people, web settings, policies, sales …
  lib/                 Logic: persistence, barcodes, pricing, stock, PDFs, descriptions, security, scanning …
  pages/
    store/             Online store pages, cart, checkout, account, chat assistant, search
    POS.tsx            Sell Now till
    catalogue/         Products, inventory, warehouse, damages
    sell/  money/  finance/  reports/  crm/  hp/  ops/  team/  admin/   Back-office screens
```

### Data

This build keeps its data in the browser (`localStorage`, through `src/lib/persist.ts`), so each device works on its own copy and the demo runs with no server. The functions in `/api` already provide the shared pieces: barcodes, shop codes, sign-ins, email and AI. Moving the remaining records to a hosted database is the next step for a multi-device, live deployment.

---

## Legal pages

The store always includes **Terms of sale**, a **Privacy policy**, **Returns & refunds**, **Delivery** and **Cookies**. They are linked from the footer and from sign-up and checkout, and there is a cookie consent banner.

The texts are ready-made templates with business details filled in automatically. Edit them in **POS → Post to webstore → Pages**. They are a starting point, not legal advice: **have a lawyer review them before launch.**

---

## Licence

Private and proprietary. All rights reserved.
