// End-to-end acceptance journey in demo mode (no external keys). Run with: npm run test:e2e
import fs from "node:fs";
import { createRequire } from "node:module";
// Resolves a project-local or globally installed Playwright.
const { chromium, devices } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR || "e2e/screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const tag = Date.now();
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`); if (!ok) failed++; };
const seen = (loc, timeout = 10000) => loc.first().waitFor({ state: "visible", timeout }).then(() => true, () => false);
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

async function signup(ctx, name, next) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(`${name.toLowerCase()}-${tag}@example.com`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/onboarding/);
  return page;
}

// E2E_PROXY lets the browser reach map tiles from a sandbox that only allows proxied egress.
const browser = await chromium.launch(process.env.E2E_PROXY ? { proxy: { server: process.env.E2E_PROXY, bypass: "localhost,127.0.0.1" } } : {});
try {
  // ---------- landing ----------
  const alice = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 });
  const lp = await alice.newPage();
  const errors = [];
  lp.on("pageerror", (e) => errors.push(String(e)));
  await lp.goto(BASE);
  check("landing page renders hero and CTA", await lp.getByRole("heading", { name: /Your trip\. Your budget/ }).isVisible() && await lp.getByRole("button", { name: "Build My Vacation" }).isVisible());
  await shot(lp, "01-landing");
  await lp.locator("#pricing").scrollIntoViewIfNeeded();
  await shot(lp, "02-pricing");
  await lp.close();

  // ---------- register + onboarding ----------
  const page = await signup(alice, "Alice");
  page.on("pageerror", (e) => errors.push(String(e)));
  check("user can register", page.url().includes("/onboarding"));
  await shot(page, "03-onboarding");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Home or departure city").fill("Chicago");
  await page.getByRole("button", { name: "Food and culture" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Museums" }).click();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.waitForURL(/\/home/);
  check("user can complete onboarding", await seen(page.getByRole("heading", { name: "Where would you like to go next?" })));
  check("preferences prefill the trip form", (await page.getByPlaceholder("Departure city").inputValue()) === "Chicago");
  await shot(page, "04-home");

  // ---------- sign out / sign in ----------
  await page.goto(`${BASE}/profile`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(BASE + "/");
  await page.goto(`${BASE}/home`);
  check("signed-out user is redirected to login", page.url().includes("/login"));
  await page.getByLabel("Email").fill(`alice-${tag}@example.com`);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  check("wrong password is rejected", await seen(page.getByText("Incorrect email or password.")));
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/home/);
  check("user can sign in", true);

  // ---------- create trip + generate ----------
  await page.getByPlaceholder("Lisbon, Tokyo, anywhere…").fill("Lisbon");
  await page.locator('input[name="budget"]').fill("3200");
  await page.getByRole("button", { name: "Build My Vacation" }).click();
  await page.waitForURL(/\/trips\/[0-9a-f-]{36}/);
  const tripUrl = page.url().split("?")[0];
  const tripId = tripUrl.split("/").pop();
  check("user can create a trip", !!tripId);
  await page.getByRole("heading", { name: /^Day 1|Arrival/ }).first().waitFor({ timeout: 60000 }).catch(() => {});
  await page.locator("section[id^=day-]").first().waitFor({ timeout: 60000 });
  const days = await page.locator("section[id^=day-]").count();
  check("structured itinerary is generated (one section per day)", days === 6, `${days} days`);
  check("sample plan is clearly labelled", await seen(page.getByText("Sample itinerary", { exact: true })));
  await shot(page, "05-itinerary");

  // ---------- edit itinerary ----------
  const day2 = page.locator("#day-2");
  const before = await day2.locator("h3").allTextContents();
  await day2.getByRole("button", { name: /^Edit / }).nth(1).click();
  await day2.getByRole("button", { name: "Later" }).click();
  await page.waitForFunction((b) => document.querySelectorAll("#day-2 h3")[1]?.textContent !== b, before[1]);
  check("itinerary items can be reordered", (await day2.locator("h3").nth(1).textContent()) === before[2]);
  await day2.getByRole("button", { name: /^Edit / }).first().click();
  await day2.getByRole("button", { name: "Remove" }).click();
  await page.waitForFunction((n) => document.querySelectorAll("#day-2 h3").length === n - 1, before.length);
  check("itinerary items can be removed", true);
  await day2.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: "Your own" }).click();
  await page.getByLabel("What are you doing?").fill("Sunset picnic");
  await page.getByRole("button", { name: /Add to day 2/ }).click();
  await day2.getByRole("heading", { name: "Sunset picnic" }).waitFor();
  check("custom activities can be added", true);
  const d3first = await page.locator("#day-3 h3").first().textContent();
  await page.locator("#day-3").getByRole("button", { name: /^Edit / }).first().click();
  await page.locator("#day-3").getByLabel("Move to another day").selectOption({ label: "Day 4" });
  await page.locator("#day-4").getByRole("heading", { name: d3first }).waitFor();
  check("activities can be moved to another day", true);

  // ---------- plan limits enforced server-side ----------
  await page.locator("#day-2").getByRole("button", { name: "Regenerate this day" }).click();
  await page.getByRole("button", { name: "Regenerate this day" }).last().click();
  check("free plan: day regeneration blocked by server", await seen(page.getByText(/Traveler Plus feature/).first()));
  await page.keyboard.press("Escape");
  await page.goto(`${BASE}/home`);
  await page.getByPlaceholder("Lisbon, Tokyo, anywhere…").fill("Tokyo");
  await page.getByRole("button", { name: "Build My Vacation" }).click();
  check("free plan: second active trip blocked by server", await seen(page.getByRole("alert").filter({ hasText: /one|1 active trip/i })));

  // ---------- map ----------
  await page.goto(`${tripUrl}/map`);
  await page.locator(".tc-pin").first().waitFor({ timeout: 20000 });
  const pins = await page.locator(".tc-pin").count();
  check("recommendations are displayed on the map", pins > 10, `${pins} markers`);
  await page.getByRole("button", { name: "Day 2", exact: true }).click();
  await page.waitForTimeout(600);
  await page.locator(".tc-pin").nth(1).click({ force: true });
  check("clicking a marker opens a detail card", await seen(page.getByText(/straight line/)));
  await shot(page, "06-map");
  await page.getByRole("tab", { name: "List" }).click();
  check("map has a list view", (await page.locator("ul > li button").count()) > 2);

  // ---------- places ----------
  await page.goto(`${tripUrl}/places`);
  check("stays show estimates and booking links", (await page.getByRole("link", { name: /Check price/ }).count()) === 3 && (await page.getByText("Rating not verified").count()) > 3);
  await shot(page, "07-places");
  await page.getByRole("button", { name: "Choose this stay" }).first().click();
  await page.getByText(/Budget updated/).waitFor();
  check("user can swap hotels", true);

  // ---------- budget ----------
  await page.goto(`${tripUrl}/budget`);
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByLabel("Description").fill("Airport transfer");
  await page.getByLabel("Amount (USD)").fill("64.50");
  await page.getByRole("button", { name: "Add expense" }).last().click();
  await page.getByText("Airport transfer").waitFor();
  await page.getByLabel("Status of Airport transfer").selectOption("paid");
  await page.waitForTimeout(800);
  check("user can add an expense and mark it paid", (await page.getByLabel("Status of Airport transfer").inputValue()) === "paid");
  await page.getByRole("button", { name: "Edit budget" }).click();
  await page.getByLabel(/Total budget/).fill("2600");
  await page.getByRole("button", { name: "Save budget" }).click();
  await page.getByText("Budget changed since the itinerary was built").waitFor();
  check("changing the budget offers to regenerate", true);
  await shot(page, "08-budget");

  // ---------- concierge ----------
  await page.goto(`${BASE}/concierge?trip=${tripId}`);
  await page.getByLabel("Message the concierge").fill("How is my budget looking?");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByText(/You've planned \$/).waitFor({ timeout: 20000 });
  await page.getByLabel("Message the concierge").fill("Find activities under $10");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByText(/estimated at \$10 or less/).waitFor({ timeout: 20000 });
  check("concierge answers with trip context and follow-ups", (await page.getByRole("button", { name: "View on map" }).count()) > 0);
  await shot(page, "09-concierge");

  // ---------- group: gated on free, works on plus ----------
  await page.goto(`${tripUrl}/group`);
  await page.getByRole("button", { name: /Invite friends/ }).click();
  await page.getByRole("button", { name: "Create invite link" }).click();
  check("free plan: invitations blocked by server", await seen(page.getByText(/part of Traveler Plus/).first()));
  await page.goto(`${BASE}/profile/billing`);
  await shot(page, "10-billing");
  await page.getByRole("button", { name: "Traveler Plus", exact: true }).click();
  await page.getByText("You're on Traveler Plus").waitFor();
  check("user can upgrade (development switcher; Stripe not configured)", true);
  await page.goto(`${tripUrl}/group`);
  await page.getByRole("button", { name: /Invite friends/ }).click();
  await page.getByRole("button", { name: "Create invite link" }).click();
  const invite = await page.getByLabel("Invite link").inputValue({ timeout: 10000 });
  check("owner can create an invite link", invite.includes("/invite/"));
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "New vote" }).click();
  await page.getByLabel("What are you deciding?").fill("Dinner on Friday?");
  const opts = page.getByPlaceholder(/^Option/);
  await opts.nth(0).fill("Cervejaria Ramiro"); await opts.nth(1).fill("Time Out Market"); await opts.nth(2).fill("A Cevicheria");
  await page.getByRole("button", { name: "Create vote" }).click();
  await page.getByRole("heading", { name: "Dinner on Friday?" }).waitFor();

  // upload a private document
  await page.goto(`${tripUrl}/companion`);
  await page.locator('input[type=file]').setInputFiles({ name: "hotel-confirmation.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test confirmation") });
  await page.getByLabel("Confirmation #").fill("LIS-48213");
  await page.getByRole("button", { name: "Upload" }).click();
  const docLink = page.getByRole("link", { name: "hotel-confirmation.pdf" });
  await docLink.waitFor({ timeout: 15000 });
  const docUrl = BASE + (await docLink.getAttribute("href"));
  check("user can upload a booking confirmation", true);
  await page.getByRole("button", { name: /Check the forecast/ }).click();
  const wx = await Promise.race([seen(page.getByText(/Forecast from Open-Meteo/), 15000).then((ok) => ok && "live forecast shown"), seen(page.getByText(/beyond the 16-day|could not be reached/), 15000).then((ok) => ok && "provider unavailable or out of range, handled gracefully")]);
  check("weather check returns a sourced forecast or a clear message", !!wx, String(wx));
  // route planning (Traveler Plus): real travel times from the routing provider, or a clear message
  await page.goto(`${tripUrl}/map`);
  await page.getByRole("button", { name: "Day 2", exact: true }).click();
  await page.getByRole("button", { name: "Get travel times" }).click();
  const rt = await Promise.race([seen(page.getByText(/min · [\d.]+ km/), 20000).then((ok) => ok && "travel times from provider"), seen(page.getByText(/could not be reached|No routing provider/), 20000).then((ok) => ok && "provider unavailable, handled gracefully")]);
  check("route planning returns provider travel times or a clear message", !!rt, String(rt));
  await page.waitForTimeout(2500);
  await shot(page, "06b-map-route");
  await page.goto(`${tripUrl}/companion`);
  await page.getByRole("button", { name: /Check the forecast/ }).click();
  await page.waitForTimeout(3000);
  await shot(page, "11-companion");

  // ---------- bob joins via invite ----------
  const bobCtx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const guest = await bobCtx.newPage();
  await guest.goto(invite);
  check("invite page previews the trip to signed-out visitors", await seen(guest.getByRole("heading", { name: "Lisbon getaway" })));
  await guest.close();
  const bob = await signup(bobCtx, "Bob", new URL(invite).pathname);
  await bob.getByRole("button", { name: "Skip for now" }).click();
  await bob.waitForURL(/\/invite\//);
  await bob.getByRole("button", { name: "Join this trip" }).click();
  await bob.waitForURL(/\/group/);
  check("invited user can join the group trip", await seen(bob.getByText("Who's coming")));
  await bob.getByRole("button", { name: /Time Out Market/ }).click();
  await bob.getByText("1 of 2 voted").waitFor();
  check("group member can vote and the leader is shown", await seen(bob.getByText("Leading", { exact: true })));
  await bob.getByRole("button", { name: "Add shared expense" }).click();
  await bob.getByLabel("Description").fill("Group dinner");
  await bob.getByLabel("Amount (USD)").fill("120");
  await bob.getByRole("button", { name: "Add expense" }).click();
  await bob.getByText("Group dinner").first().waitFor();
  check("group member can add a shared expense that is split", await seen(bob.getByText("$60.00")));
  await bob.locator("#comment-box").fill("Can't wait!");
  await bob.getByRole("button", { name: "Post" }).click();
  await bob.getByText("Can't wait!").waitFor();
  check("group member can comment", true);
  await shot(bob, "12-group");
  const bobDoc = await bobCtx.request.get(docUrl);
  check("trip member can open the private document", bobDoc.status() === 200);

  // owner demotes bob to viewer -> bob can no longer edit
  await page.goto(`${tripUrl}/group`);
  await page.getByLabel("Role for Bob").selectOption("viewer");
  await page.getByText("Permissions updated").waitFor();
  await bob.goto(tripUrl);
  check("viewer sees the itinerary but has no edit controls", (await bob.locator("section[id^=day-]").count()) === 6 && (await bob.getByRole("button", { name: /^Edit / }).count()) === 0);
  await bob.goto(`${tripUrl}/budget`);
  check("viewer cannot add expenses", (await bob.getByRole("button", { name: "Add expense" }).count()) === 0);

  // ---------- privacy: a stranger ----------
  const carolCtx = await browser.newContext();
  const carol = await signup(carolCtx, "Carol");
  await carol.getByRole("button", { name: "Skip for now" }).click();
  await carol.waitForURL(/\/home/);
  await carol.goto(tripUrl);
  // The app shell streams first, so the status is 200; what matters is that no trip data is rendered.
  check("stranger cannot open someone else's trip", (await seen(carol.getByText("We couldn't find that page"))) && (await carol.getByText("Lisbon getaway").count()) === 0 && (await carol.locator("section[id^=day-]").count()) === 0);
  await carol.goto(`${tripUrl}/budget`);
  check("stranger cannot open the trip's budget", (await seen(carol.getByText("We couldn't find that page"))) && (await carol.getByText("Airport transfer").count()) === 0);
  check("stranger cannot download the trip's document", (await carolCtx.request.get(docUrl)).status() === 404);
  const anon = await browser.newContext();
  check("signed-out request for a document is refused", (await anon.request.get(docUrl)).status() === 401);
  check("unsigned Stripe webhook is rejected", [400, 503].includes((await anon.request.post(`${BASE}/api/stripe/webhook`, { data: "{}" })).status()));

  // ---------- downgrade ----------
  await page.goto(`${BASE}/profile/billing`);
  await page.getByRole("button", { name: "Free Explorer", exact: true }).click();
  await page.getByText("You're on Free Explorer").waitFor();
  check("user can downgrade", true);
  await page.goto(`${tripUrl}/companion`);
  check("downgraded plan loses document uploads (server-rendered gate)", await seen(page.getByText("Document storage is part of Traveler Plus")));

  // ---------- discover / surprise me ----------
  await page.goto(`${BASE}/discover`);
  await page.getByRole("button", { name: "Surprise me" }).click();
  await page.getByRole("button", { name: "Show different ideas" }).waitFor({ timeout: 20000 });
  check("Surprise Me returns destinations", (await page.getByRole("link", { name: "Plan this trip" }).count()) >= 2);
  await shot(page, "13-discover");
  await page.goto(`${BASE}/trips`);
  check("trip is saved and listed under My Trips", await seen(page.getByRole("heading", { name: "Lisbon getaway" })));

  // ---------- mobile ----------
  const mctx = await browser.newContext({ ...devices["iPhone 14"], storageState: await alice.storageState() });
  const m = await mctx.newPage();
  await m.goto(tripUrl);
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("mobile: itinerary fits the viewport with bottom navigation", overflow <= 1 && await m.getByRole("navigation", { name: "Primary" }).isVisible(), `overflow ${overflow}px`);
  await m.screenshot({ path: `${SHOTS}/14-mobile-itinerary.png` });
  await m.goto(`${BASE}/home`);
  await m.screenshot({ path: `${SHOTS}/15-mobile-home.png` });
  await m.goto(`${tripUrl}/budget`);
  check("mobile: budget fits the viewport", (await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1);
  await m.screenshot({ path: `${SHOTS}/16-mobile-budget.png` });

  check("no uncaught browser errors", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (e) {
  console.error("JOURNEY ABORTED:", e.message.split("\n").slice(0, 6).join("\n"));
  failed++;
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} check(s) failed` : "\nAll journey checks passed");
process.exit(failed ? 1 : 0);
