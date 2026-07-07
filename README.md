# EventLedger

A shared, multi-user event operations app: serialized inventory, supplier price
comparison, invoice tracking, and an automated P&L dashboard. Everyone who opens
the site sees and edits the same live data.

## How it works

- **Frontend**: React + Vite, all logic in `src/App.jsx`.
- **Data**: stored in a single Supabase (hosted Postgres) table, `eo_kv`, as
  simple key/value rows — one row per data set (items, suppliers, invoices, etc).
- **Live sync**: the app subscribes to Supabase Realtime, so when one person
  saves an invoice, everyone else's screen updates within about a second — no
  refresh needed.
- **No login screen**: anyone with the site's URL can view and edit. That's the
  simplest setup for a small trusted team. See "Adding a login" below if you
  want to require sign-in later.

## 1. Create your Supabase project (free)

1. Go to [supabase.com](https://supabase.com) and create a free account and a new project.
2. Once it's ready, open **SQL Editor** in the left sidebar, paste in the contents
   of `supabase/schema.sql` from this project, and click **Run**. This creates
   the shared data table and turns on realtime sync.
3. Open **Settings > API**. You'll need two values from this page:
   - **Project URL**
   - **anon public** key (NOT the `service_role` key — that one is secret and
     should never go in frontend code)

## 2. Configure the app

1. In this project folder, copy `.env.example` to a new file named `.env`.
2. Paste your Project URL and anon key into it:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## 3. Run it locally

```bash
npm install
npm run dev
```

Open the printed `localhost` URL. Open it in two browser tabs (or on your phone
and laptop) to see live sync in action.

## 4. Deploy it so others can reach it

The easiest free option is **Vercel**:

1. Push this project to a GitHub repository.
2. Go to [vercel.com](https://vercel.com), sign in, and click **Add New > Project**, then pick your repo.
3. Vercel auto-detects Vite. Before deploying, add the same two environment
   variables from your `.env` file under **Settings > Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**. You'll get a public `https://your-app.vercel.app` URL —
   share that with your team.

(Netlify or Cloudflare Pages work the same way: connect the repo, set the same
two env vars, deploy.)

## Notes & next steps

- **No login yet.** Anyone with the URL can view and edit everything — fine for
  a small trusted team, but worth knowing. To add a login screen later:
  Supabase has built-in email/password and magic-link auth. You'd add a sign-in
  screen using `supabase.auth`, and tighten the SQL policies in `schema.sql` to
  require `auth.role() = 'authenticated'` instead of `anon`.
- **File uploads for invoices** currently store the file as inline base64 data
  inside the row (fine for a few small receipts). If your team will upload many
  or large files, ask and I can switch this to Supabase Storage instead, which
  is built for that.
- **Currency and fonts** are controlled from the in-app Admin Settings page and
  are part of the same shared data, so they're consistent for everyone too.

## Modify new Category

- **Add New Category.** a new category can add new and add more if you want to using it
- **Below Setting Panel.** Show Category lists below Setting panel you can see and working it easyies