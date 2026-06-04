# K2 Manager

A production job queue management app for custom printing and merchandise teams.

## First Version

- Supabase Auth-ready login and signup for Owner, Admin, Designer, Production Staff, Packing Staff, and Sales Staff.
- Demo role login still works when Supabase environment variables are not configured.
- Interactive dashboard, kanban queue, calendar, customers, job detail, payment tracking, comments, status history, and audit log.
- Customer CMS for creating, searching, editing, and protecting customer records with linked job history.
- Team management for Owner/Admin users, including profile role assignment.
- Jobs, customers, comments, status history, payments, company settings, and audit activity connect to Supabase when configured.
- Supabase schema, profile trigger, and RLS policies in `supabase/schema.sql`.
- Netlify deployment config in `netlify.toml`.

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Supabase Setup

### Option A: Supabase Cloud

1. Create a Supabase project.
2. Run `supabase/setup_safe.sql` in the SQL editor. This file is safe to run again if part of the schema already exists.
3. If you prefer the original split setup, run `supabase/schema.sql` and then `supabase/production_setup.sql`.
4. Optional: run `supabase/seed.sql` in the SQL editor to create starter customers and jobs.
5. Copy `.env.example` to `.env.local`.
6. Add these environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-publishable-or-anon-key"
```

### Option B: Local Supabase CLI

Install Supabase CLI, then run:

```bash
supabase start
supabase db reset
```

Copy the local API URL and anon key printed by the CLI into `.env.local`.

When the environment variables are present, the login card enables Supabase email/password auth. New signups create a row in `profiles` through the `handle_new_user` trigger. Without the variables, the app uses local demo users so the UI remains previewable.

When signed in with Supabase, the app reads and writes production records from Supabase. Demo records are only used when Supabase is not configured or as a fallback preview.

## Netlify Deploy

The project is ready for Netlify.

```bash
npm run build
```

Netlify settings:

- Build command: `npm run build`
- Publish directory: `.next`
- Node version: `20`

Set these environment variables in Netlify:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NETLIFY_NEXT_SKEW_PROTECTION=true`

Also add your Netlify production URL to Supabase Auth redirect URLs.

See `NETLIFY_DEPLOY.md` for the launch checklist.
