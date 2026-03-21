# TicketFlow

TicketFlow is a role-based internal support desk for managers, employees, and operators.

## Local run

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## Authentication model

- Manager self-signup is bootstrap-only.
- If at least one manager already exists, public manager sign-up is disabled.
- Employees and operators cannot self-register.
- Managers create employee and operator accounts from the dashboard.
- Optional legacy manager login is disabled by default unless `MANAGER_PASSWORD` is set.

## Environment variables

Copy `.env.example` to `.env` and update the values you need.

- `TICKETFLOW_AUTH_SECRET`: required for signed auth tokens.
- `GOOGLE_CLIENT_ID`: enables manager Google sign-in.
- `VITE_API_BASE_URL`: required when the frontend and backend are hosted on different domains.
- `MANAGER_*`: optional emergency bootstrap manager login. Keep empty in production unless you intentionally need it.

## Deployment guidance

### GitHub

Use GitHub to store the source code and version history. This project is ready to push once you add your remote and commit the files.

### Vercel

Vercel is a good choice for the React frontend.

Set:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://your-backend-domain/api`

### Backend hosting

This project currently stores data in `server/ticketflow-data.json`, so the backend should run on a host that keeps a writable filesystem or, better, be upgraded to a real database.

Recommended production options:

- Render or Railway for the Node/Express backend
- Supabase Postgres, Neon, or another managed database for durable storage

If you deploy the backend to a serverless platform with ephemeral storage, ticket data will not be reliable across restarts.

## Google sign-in checklist

- Create a Google OAuth client
- Add your production site under Authorized JavaScript origins
- Publish the consent screen to production if needed
- Use your real HTTPS domain in production
- Add the same Google client ID to the backend environment

## Production hardening ideas

- Replace the JSON file datastore with Postgres
- Add manager-created manager accounts with audit logging
- Force password rotation for newly created employee and operator accounts
- Add email notifications for new assignments and SLA breaches
