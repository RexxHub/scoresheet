# CA Score Portal (React + Vite)

Teachers key in continuous assessment scores per subject; the app totals, grades and prints one report slip per student.

## Run locally
    npm install
    npm run dev

## Deploy on Vercel
1. Push this folder to a GitHub repository.
2. In Vercel choose Add New > Project and import the repository.
3. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
4. Deploy.

(Netlify works the same way: build `npm run build`, publish directory `dist`.)

## Notes
- Data is stored in the browser (localStorage) on each device. For shared data across teachers and logins, add a backend such as Supabase.
- Grade scale: A 80-100, B 70-79, C 60-69, P 50-59, F 0-49. Edit `gradeOf` in `src/lib.js` to change it.

## Teacher accounts (Supabase)
1. Create a free project at supabase.com.
2. Open SQL Editor, paste the contents of `supabase.sql`, and run it. This creates the `ca_state` table and makes each teacher see only their own data. It is safe to run twice. If you forget, the app shows this SQL on screen with a Copy button.
3. Give the app your Project URL and anon key (Project Settings > API) in any ONE of these ways:
   - Easiest: open the app and paste them on the "Connect to Supabase" screen. It tests them and remembers them in that browser.
   - Copy `.env.example` to `.env` and fill them in, then restart `npm run dev`.
   - Or paste them into `src/config.js` (the anon key is public by design) and push to GitHub, which works on Netlify without environment variables.
4. Run `npm install` then `npm run dev`. You will see the log in / create account screen.
5. On Vercel: Project Settings > Environment Variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.
6. Optional: in Supabase Authentication > Providers > Email, turn off "Confirm email" if you want teachers to log in right after signing up.

Without the two variables, the app runs in offline mode and saves to the browser only.
