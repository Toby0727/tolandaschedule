# Syllabus Schedule Builder

Upload a course syllabus PDF and get a full semester schedule — organized by week, month, and deadline.

## Stack
- Next.js 14 (App Router)
- Anthropic Claude API
- No other dependencies

## Deploy to Vercel in 3 steps

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "initial commit"
gh repo create syllabus-builder --public --push
```

### 2. Import to Vercel
Go to [vercel.com/new](https://vercel.com/new), import your GitHub repo, and click Deploy.

### 3. Add your API key
In your Vercel project → **Settings → Environment Variables**, add:
```
ANTHROPIC_API_KEY = sk-ant-...
```
Then redeploy.

## Run locally
```bash
npm install
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local
npm run dev
```
Open http://localhost:3000
