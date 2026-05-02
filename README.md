# Wattstat

Wattstat is a scorekeeping and stats app for the Suedtiroler variant of Watten.

It acts as digital `Wattblock` but also allows users to save finished games and track win/loss and money statistics.

## Current Features

- Guest mode with local storage
- Account mode with Supabase sync
- Username, email, and password auth
- Live mobile score board
- Editable and deletable games
- Money result tracking
- Game and Round based stats

## Stack

- React
- TypeScript
- Vite
- Supabase
- Vercel

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Create a local env file based on `.env.example`

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
VITE_SUPABASE_REDIRECT_URL=http://localhost:5173
```

3. Start the dev server

```bash
npm run dev
```

## Supabase Setup

Run the SQL in [supabase/schema.sql].

The schema creates:
- `profiles`
- `games`
- `rounds`
- row-level security policies for per-user access

## Deployment

The app is designed for static deployment on Vercel.

Required environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_REDIRECT_URL`

SPA routing is configured in `vercel.json`.

## Public Repo Safety Notes

- `.env.local` is gitignored and must stay private
- the Supabase publishable key is safe to expose in the frontend
- never commit a Supabase service-role key
- never commit production passwords, tokens, or session exports

## Status

This project is still evolving and optimized for personal/friend usage first, with future plans for richer player relationships and stats.
