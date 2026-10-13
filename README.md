# Fika Bakery

A demo website for Fika, a fictional bakery and café. It's built with plain, hand-written HTML and CSS, with no frameworks or build step.

**[View the live site →](https://nataliyabenova-walsh.github.io/bageti/)**

[![Fika Bakery homepage](docs/screenshot.png)](https://nataliyabenova-walsh.github.io/bageti/)

## Sections

- **Hero:** full-height photo with a welcome banner and a link to the menu
- **Product tiles:** a photo and colour-block grid for cakes, cookies, sandwiches and pies, and breads
- **Menu:** products grouped by category, with descriptions and prices
- **Locations:** the bakery's shops
- **Contact:** email and phone

The layout is responsive: under 768px the tiles stack into two columns and the menu and locations go full-width.

## Built with

- **Semantic HTML5**
- **CSS Flexbox and Grid** for layout, plus a CSS reset
- **Google Fonts** (Fira Sans Condensed, Kalam)
- **Font Awesome** icons
- Hosted on **GitHub Pages**
- Photos from [Pexels](https://www.pexels.com), resized and converted to WebP

## Run locally

No build is needed. Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Ordering app (in progress)

A full-stack ordering system is being built alongside the static site:

- **`client/`:** React, TypeScript, Vite and Tailwind CSS
- **`server/`:** Node, Express and TypeScript, with Prisma and PostgreSQL (hosted on [Neon](https://neon.tech))

To run it you need Node.js 22+ and a PostgreSQL database:

```bash
npm install
cp server/.env.example server/.env   # then add your DATABASE_URL
npm run db:migrate -w server
npm run dev                          # client on :5173, API on :3001
```

## Structure

```
index.html     Page markup
css/           Reset and main stylesheet
data/          Menu data (menu.json), used later to seed the ordering system's database
images/        Product and location photos
docs/          README screenshot
client/        React ordering app
server/        Express API and Prisma schema
```
