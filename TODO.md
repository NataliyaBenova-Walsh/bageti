# To-do

The plan for this project:

1. Turn it into a fictional demo brand.
2. Improve the current static site.
3. Grow it into a full-stack ordering system.

## 1. Make it a fictional demo brand (do first)

This site was originally built for a real bakery, but the business was sold before handover. It shouldn't use a real business's identity in a public portfolio.

- [x] Pick a fictional bakery name, and check it isn't a real bakery in Sofia (**Fika**)
- [x] Move the bakery to Sweden: Stockholm, Gothenburg and Malmö shops, SEK prices, Swedish time zone and hours. "Fika" is a common Swedish word, so cafés with this name likely exist in Sweden; the footer's demo note makes clear this one isn't real.
- [x] Replace the logo (`images/logo-2.jpg` is the real logo) with a new text or SVG logo
- [x] Replace the 3 real addresses and location names (NDK, Iztok, UACG) with fictional ones
- [x] Replace the Facebook and Instagram links (header and footer) with `#` placeholders, or remove them
- [x] Replace the real email and phone number with placeholders (e.g. `hello@example.com`)
- [x] Replace the real storefront photos (`bageti-skobelev.jpg`, `smirnenski.jpg`, `counter.jpg`) with free-licence stock photos (Unsplash, Pexels). The product photos (fika, cookies, tart, brownies, etc.) need replacing too: the hero and cookie photos show "BAGETI" on the packaging.
- [x] Add a small "Demo project, not a real shop" note in the footer
- [x] Update `<title>`, headings and README with the new name
- [x] Retake the README screenshot (after the photos are replaced)
- [ ] Rename the GitHub repo (GitHub redirects the old repo URL), then update the links in the profile README and `README.md`. The old Pages URL (`github.io/bageti/`) probably won't redirect, so update every link to it at the same time.
- [ ] **Git history:** the real logo, email, phone and photos stay in earlier commits even after they're replaced. If that matters, start a fresh repo (or squash history) once this phase is done, rather than renaming.
- [x] Delete the 14 unused images: `capuchino.jpg`, `christma-counter.jpg`, `christmas-tea.jpg`, `cinnamon-bun.jpg`, `finansie.jpg`, `ginger-hearts.jpg`, `ginger-men.jpg`, `hot-chocolate.jpg`, `kozunak.jpg`, `kozunak-2.jpg`, `logi.jpg`, `luxa.org-opacity-changed-panoramic-bageti.jpg`, `pavlova.jpg`, `small-cookies.jpg`
- [x] Delete `css/index.html`, an empty HTML page that isn't used

## 2. UI and UX improvements

The React + Tailwind client in phase 3 will replace this site, so do the items that carry over first: typos, menu details, contrast and accessibility. Do the layout, performance and font work only if the static site will stay live for a long time.

- [x] **Responsive layout:** `style.css` has no media queries, so the 4-column grid is squashed on phones. Stack to 1–2 columns under 768px, and make the menu and location cards full-width.
- [x] **Broken class:** `class="banana-img small div"` should be `small-div`, so that tile currently misses its styles.
- [x] **Menu details:** items have names only. Add short descriptions and prices in EUR (Bulgaria uses the euro since January 2026). Keep them in a JSON file that later seeds the database for the ordering system.
- [x] **Typos:** croisants → croissants, Artisian → Artisan, Chockolate → Chocolate, Finansie → Financier, Eincorn → Einkorn, Wholewheet → Wholewheat, "Oatmeal raisins cookies" → "Oatmeal raisin cookies"
- [x] **Contrast:** cream text on beige tiles (`#FFF3D9` on `#B29682`) is about 2.5:1, below the WCAG minimum of 4.5:1. Darken the beige or use dark text.
- [x] **Accessibility:** images are CSS backgrounds, so they have no alt text. Use `<img alt>` for meaningful photos. Add `aria-label`s to the icon-only social links, and fix the heading order (h2 jumps to h4).
- [x] **Anchor links:** the sticky header covers section titles, so add `scroll-margin-top`. Move `scroll-behavior: smooth` from `body` to `html`. Remove the caret-down icons from the nav links, because they look like dropdowns.
- [x] **Contact section:** `#contacts` is empty. Merge it with the "Do you have a question?" block into a proper contact section, with a map link for each location. (Map links skipped: the addresses are fictional, so a map would point nowhere.)
- [x] **Hero:** add a call-to-action button ("See the menu", later "Order now").
- [x] **Performance:** images are up to 1 MB as JPG. Convert them to WebP and resize. 4 Google Font families are loaded with every weight; keep 2 families and only the weights used. Add `loading="lazy"` to images below the fold.
- [x] **Head and meta:** favicon, meta description, Open Graph tags, and the year in the footer ©
- [x] **Opening hours:** "08.00-20.00" → "Mon–Sun 08:00–20:00", or hours per day

## 3. Full-stack ordering system

1. [x] **Setup:** npm workspaces monorepo with `client/` (React + TypeScript + Vite + Tailwind) and `server/` (Node + Express + TypeScript), PostgreSQL on Neon + Prisma. (Neon is used for development too, instead of Docker Compose, because Docker isn't installed.)
2. [x] **Menu from the database:** products and categories API, with the client rendering the menu from the API. Seed it from the phase 2 menu JSON. Store prices as integer cents in EUR. **Deploy at this point** (Vercel + Render or Railway + Neon), with GitHub Actions CI. (Deployed: client on Vercel at bageti.vercel.app, API on Render's free plan at fika-api-eqig.onrender.com.)
3. [x] **Cart and orders:** Zustand cart (persisted), checkout with React Hook Form + Zod (pickup location and time), orders saved as "pay at pickup". Pickup rules: only times within opening hours, a minimum lead time, and products staff can mark as sold out. (Done: sold-out products are shown and refused; the staff screen to mark them comes with the admin panel in step 4.)
4. [x] **Admin panel:** auth with roles (customer and admin), product management with image upload, order list with status changes (New → Baking → Ready → Picked up). Choose the auth approach first (e.g. Auth.js/Lucia, or JWT in httpOnly cookies). Store uploads in Cloudinary or S3/R2, because Render and Railway erase their local disk on each deploy. (Done: email and password login with a JWT in an httpOnly cookie, roles, order board, product editing and sold-out switch. Image upload is postponed; it will use Cloudinary.)
   - [ ] **Product photos:** upload to Cloudinary from the products page, and show photos on the menu
5. [ ] **Payments:** Stripe Checkout in test mode, plus a webhook that marks orders as paid
6. [ ] **Realtime and extras:** live order feed for staff (WebSockets or SSE), confirmation email, sales dashboard (Recharts)
7. [ ] **Quality:** Vitest API tests, a Playwright end-to-end test for the order flow, OpenAPI docs, a README with an architecture diagram and a demo admin login
