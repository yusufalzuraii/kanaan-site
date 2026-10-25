# Kanaan Shop — Website

## Run locally
npm install
npm run dev

## Build for production
npm run build
# output goes to the dist/ folder

## Deploy for free (easiest — no account needed to try)
1. Go to https://app.netlify.com/drop
2. Drag the whole `dist` folder onto the page
3. Netlify gives you a free live link instantly (e.g. random-name.netlify.app)
4. Create a free Netlify account to keep the site online permanently
   and to connect your own domain (Site settings → Domain management)

## Deploy with GitHub + Vercel (more control, still free)
1. Create a GitHub account (github.com) if you don't have one
2. Create a new repository and upload this whole folder to it
3. Go to https://vercel.com, sign in with GitHub, click "Add New Project"
4. Select this repository — Vercel auto-detects Vite and deploys it
5. Every future `git push` automatically redeploys the live site

## Before going live
- Replace WHATSAPP_NUMBER in src/App.jsx with the real WhatsApp number
- Replace the "K" logo badge with your real PNG logo (see project chat)
- Buy a domain (e.g. Namecheap, GoDaddy, or a Lebanese registrar for .com.lb)
  and connect it from your hosting provider's Domain settings
