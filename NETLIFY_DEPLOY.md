# Deploy K2 Manager to Netlify

## Netlify build settings

- Build command: `npm run build`
- Publish directory: `out`
- Node version: `20`

These values are also saved in `netlify.toml`. The app is exported as a static Next.js site because all production data access happens in the browser through Supabase.

## Required environment variables

Add these in Netlify:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NETLIFY_NEXT_SKEW_PROTECTION=true`

## Supabase setup before launch

Run these SQL files in Supabase SQL Editor:

1. `supabase/schema.sql`
2. `supabase/production_setup.sql`

Then confirm Auth email settings and allowed redirect URLs include your Netlify URL.

## Deploy steps

1. Push this project to GitHub.
2. In Netlify, choose Add new site -> Import from Git.
3. Select the repository.
4. Confirm the build settings above.
5. Add the environment variables.
6. Deploy.
