# To-do

The plan for this project:

1. Turn it into a fictional demo brand.
2. Improve the current static site.
3. Grow it into a full-stack ordering system.

## 1. Make it a fictional demo brand (do first)

This site was originally built for a real bakery, but the business was sold before handover. It shouldn't use a real business's identity in a public portfolio.

- [ ] Pick a fictional bakery name, and check it isn't a real bakery in Sofia
- [ ] Replace the logo (`images/logo-2.jpg` is the real logo) with a new text or SVG logo
- [ ] Replace the 3 real addresses and location names (NDK, Iztok, UACG) with fictional ones
- [ ] Replace the Facebook and Instagram links (header and footer) with `#` placeholders, or remove them
- [ ] Replace the real email and phone number with placeholders (e.g. `hello@example.com`)
- [ ] Replace the real storefront photos (`bageti-skobelev.jpg`, `smirnenski.jpg`, `counter.jpg`) and other business photos with free-licence stock photos (Unsplash, Pexels)
- [ ] Add a small "Demo project, not a real shop" note in the footer
- [ ] Update `<title>`, headings, README and screenshot with the new name
- [ ] Rename the GitHub repo (GitHub redirects the old URL), then update the links in the profile README and `README.md`, and the Pages URL
- [ ] Delete unused images (Christmas set, `luxa.org-opacity-changed-panoramic-bageti.jpg`, etc.)

## 2. UI and UX improvements

- [ ] **Responsive layout:** `style.css` has no media queries, so the 4-column grid is squashed on phones. Stack to 1–2 columns under 768px, and make the menu and location cards full-width.
- [ ] **Broken class:** `class="banana-img small div"` should be `small-div`, so that tile currently misses its styles.
- [ ] **Menu details:** items have names only. Add short descriptions and prices, which also become the data model for the ordering system.
- [ ] **Typos:** croisants → croissants, Artisian → Artisan, Chockolate → Chocolate, Finansie → Financier, Eincorn → Einkorn, Wholewheet → Wholewheat, "Oatmeal raisins cookies" → "Oatmeal raisin cookies"
- [ ] **Contrast:** cream text on beige tiles (`#FFF3D9` on `#B29682`) is about 2.5:1, below the WCAG minimum of 4.5:1. Darken the beige or use dark text.
- [ ] **Accessibility:** images are CSS backgrounds, so they have no alt text. Use `<img alt>` for meaningful photos. Add `aria-label`s to the icon-only social links, and fix the heading order (h2 jumps to h4).
- [ ] **Anchor links:** the sticky header covers section titles, so add `scroll-margin-top`. Move `scroll-behavior: smooth` from `body` to `html`. Remove the caret-down icons from the nav links, because they look like dropdowns.
- [ ] **Contact section:** `#contacts` is empty. Merge it with the "Do you have a question?" block into a proper contact section, with a map link for each location.
- [ ] **Hero:** add a call-to-action button ("See the menu", later "Order now").
- [ ] **Performance:** images are up to 1 MB as JPG. Convert them to WebP and resize. 4 Google Font families are loaded with every weight; keep 2 families and only the weights used. Add `loading="lazy"` to images below the fold.
- [ ] **Head and meta:** favicon, meta description, Open Graph tags, and the year in the footer ©
- [ ] **Opening hours:** "08.00-20.00" → "Mon–Sun 08:00–20:00", or hours per day

## 3. Full-stack ordering system

1. [ ] **Setup:** monorepo with `client/` (React + TypeScript + Tailwind) and `server/` (Node + Express or NestJS + TypeScript), PostgreSQL + Prisma, Docker Compose for local development
2. [ ] **Menu from the database:** products and categories API, with the client rendering the menu from the API. **Deploy at this point** (Vercel + Render or Railway + Neon), with GitHub Actions CI.
3. [ ] **Cart and orders:** Zustand cart (persisted), checkout with React Hook Form + Zod (pickup location and time), orders saved as "pay at pickup"
4. [ ] **Admin panel:** auth with roles (customer and admin), product management with image upload, order list with status changes (New → Baking → Ready → Picked up)
5. [ ] **Payments:** Stripe Checkout in test mode, plus a webhook that marks orders as paid
6. [ ] **Realtime and extras:** live order feed for staff (WebSockets or SSE), confirmation email, sales dashboard (Recharts)
7. [ ] **Quality:** Vitest API tests, a Playwright end-to-end test for the order flow, OpenAPI docs, a README with an architecture diagram and a demo admin login
