# ZeroClub — zeroclub.tech

A premium, dark-editorial freelance developer portfolio for Ashutosh Kaithwas, built with plain HTML/CSS/JS (no build step required) so it can be deployed anywhere as static files.

## Animation

Motion is powered by [GSAP](https://gsap.com) + ScrollTrigger, loaded from a CDN in `index.html` — no install needed. It's used sparingly: a single orchestrated hero entrance on load, and a batched fade/rise for sections as they scroll into view (`js/script.js`, `RevealModule` / `HeroTimelineModule`). Everything respects `prefers-reduced-motion`, and the site still works (content just appears instantly, no animation) if the CDN is ever blocked.

The **Featured Work** section is collapsed by default — click "Show projects" to expand the four case studies. This keeps the initial page short; the projects are still fully in the DOM (good for SEO/crawlers) and just visually collapsed until opened.

## Run locally

No build tooling needed. From this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Before you go live — replace these placeholders

1. **Contact form backend** — `js/script.js`, in `ContactModule`, set:
   ```js
   const FORM_ENDPOINT = 'https://formspree.io/f/xxxxxxx';
   ```
   Sign up at [formspree.io](https://formspree.io) (free tier works fine), create a form, and paste the endpoint. Until you do this, the "Send project inquiry" button falls back to opening the visitor's email client with a pre-filled message — so the form is never fake, just less automated until you wire up a real backend.

2. **Email** — replace `hello@zeroclub.tech` in `index.html` (contact section + mailto fallback in `script.js`) with your real address.

3. **Social links** — in `index.html`, update the LinkedIn and GitHub URLs (search for `linkedin.com/in/ashutosh-kaithwas` and `github.com/ashutoshkaithwas`) to your real profiles. Add Instagram/WhatsApp links in the `.contact-direct` block if you want them.

4. **Project links** — in `js/data.js`, each project has `links: { github, demo }`. Fill in real repo/demo URLs; set `demo: null` to hide the button if there's no live demo.

5. **Project visuals** — projects currently use a small generated abstract canvas visual (no stock photos, per the brief) so there's nothing broken on first load. Swap `drawProjectVisual()` in `js/script.js` for real screenshots/mockups by replacing the `<canvas class="pv-canvas">` with an `<img>` once you have real UI screenshots — see the `project-visual` / `ov-visual` CSS classes for sizing (16:10 and 16:9 respectively).

6. **OG image** — `index.html` references `https://zeroclub.tech/assets/og-image.jpg`. Add a real 1200×630 image at that path (a screenshot of the hero works well).

## Adding or editing content

All copy that's likely to change lives in **`js/data.js`**, separate from markup:
- `services` — the six service rows
- `tech` — grouped toolkit list + marquee
- `projects` — case studies (edit or add new ones; each renders both the work-list card and the overlay case study automatically)
- `faq`, `process`

To add a new project, add an object to the `projects` array with the same shape as the existing ones — no HTML editing required.

## Deployment

Static files, so any static host works: Vercel, Netlify, GitHub Pages, Cloudflare Pages. Point the custom domain `zeroclub.tech` at whichever you choose and the site is live.

## Notes on what's real vs. placeholder

Per the brief, no fake testimonials, client counts, or stats are included anywhere. The three items above (email, socials, form endpoint) are the only placeholders — everything else (copy, project case studies, FAQ, structure) is final content ready to ship.
