# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The studio site for Entropic Software Labs, a one-person studio. Visitors arrive at a product page from a shared link, the Projects drawer or a search, and decide whether to open or install that app.

Each product page speaks to its own audience:

- **Card Games**: Malaysian Chinese friends and family who already know Dou Di Zhu (斗地主), Big Two (锄大地) and Blackjack / Ban Luck from Chinese New Year gatherings and coffee-shop tables. The app is that table, online or against bots.
- **Quick Vote**: built for a university fellowship in a church, to run next year's committee elections during a gathering. Other uses (classes, societies, committees) are welcome, but casual "where should we eat" polls are not the point; WhatsApp polls already do that.
- **Spectrum+**: University of Malaya students who use the Spectrum LMS.

## Product Purpose

Show each app doing its job and get the visitor into it: Play for Card Games, Open for Quick Vote, install for the Android apps.

## Positioning

- **Quick Vote**: the host controls who is in the room. Voters type a six-digit PIN and a name, then wait in a queue until the host approves them, so only people with the right to vote can vote. The host also decides when results go live. No accounts, nothing to install. Load-tested with 300 people voting at once.
- **Card Games**: the bots only see what a player at their seat would see; a stronger bot plays better, it never cheats. Seven strengths, Novice to Grandmaster. Online rooms for Dou Di Zhu and Big Two with invite links or five-character codes; bots fill empty seats and take over for anyone who drops.

## Operating Context

- Quick Vote is used live, in one room: the host reads the PIN aloud, people join on their phones, the host approves names, votes land, and results show on every screen at once when the host turns Live on.
- Card Games runs in the browser, installs to the home screen, opens full screen in landscape, and single player works offline once loaded.

## Capabilities and Constraints

- Plain static HTML, CSS and JS on Cloudflare Pages, no build step. The CSP blocks inline scripts and styles, and loads fonts and scripts only from the site itself (`default-src 'self'`).
- Each product page keeps the shared site top bar (brand, Projects drawer, theme toggle) and footer.
- Card Games coins are play money only: no real-money stakes, payments or transfers. Never imply gambling.
- Quick Vote: single or multiple choice, 2 to 20 options, anonymous or named-to-host.

## Brand Commitments

- Each product page may commit to its own visual world and drop the site's light/dark theme, as Spectrum+ does (confirmed 2026-10-23 for Card Games and Quick Vote).
- Plain, specific copy. No marketing superlatives.

## Evidence on Hand

- Screenshots: `assets/shots/card-games-bid.webp`, `assets/shots/qv-*.webp` (light and dark).
- OG images: `assets/og/card-games-2.jpg`, `assets/og/quick-vote.jpg`.
- `js/qv-phone.js` is a working, tappable replica of the Quick Vote web app.
- No testimonials, user counts or ratings exist. Do not invent them.

## Product Principles

- Show the app working rather than describe it.
- Say what it does and what it does not do, plainly.
- Each product page belongs to its audience's world, not to a generic template.
