// Smoke test for the "plain Postgres + built-in sign-in" hosting mode (e.g. Neon).
// Start the server with DATABASE_URL set and FREE_ACCESS_PLAN=pro, then: npm run test:hosted
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3100";
const tag = Date.now();
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`); if (!ok) failed++; };
const seen = (loc, timeout = 12000) => loc.first().waitFor({ state: "visible", timeout }).then(() => true, () => false);

const browser = await chromium.launch();
try {
  const health = await (await fetch(`${BASE}/api/health`)).json();
  check("server reports hosted mode, not demo mode", health.ok && health.demoMode === false && health.integrations.database === true, JSON.stringify(health));

  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/signup`);
  check("social sign-in buttons are hidden without Supabase", (await page.getByRole("button", { name: /Continue with/ }).count()) === 0);
  await page.getByLabel("Your name").fill("Owner");
  await page.getByLabel("Email").fill(`owner-${tag}@example.com`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/onboarding/);
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.waitForURL(/\/home/);
  check("sign-up works on hosted Postgres", true);
  check("no demo-mode banner is shown", (await page.getByText(/Demo mode:/).count()) === 0);

  await page.getByPlaceholder("Lisbon, Tokyo, anywhere…").fill("Tokyo");
  await page.getByRole("button", { name: "Build My Vacation" }).click();
  await page.waitForURL(/\/trips\/[0-9a-f-]{36}/);
  await page.locator("section[id^=day-]").first().waitFor({ timeout: 60000 });
  const tripUrl = page.url().split("?")[0];
  check("trip and itinerary are created", (await page.locator("section[id^=day-]").count()) === 6);

  await page.goto(`${tripUrl}/companion`);
  await page.locator("input[type=file]").setInputFiles({ name: "ticket.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 hosted-mode test file") });
  await page.getByRole("button", { name: "Upload" }).click();
  const link = page.getByRole("link", { name: "ticket.pdf" });
  check("document upload works with FREE_ACCESS_PLAN=pro", await seen(link, 15000));
  const docUrl = BASE + (await link.getAttribute("href"));
  const res = await ctx.request.get(docUrl);
  check("document is stored in the database and downloads intact", res.status() === 200 && (await res.text()).includes("hosted-mode test file"));
  check("signed-out request for the document is refused", (await (await browser.newContext()).request.get(docUrl)).status() === 401);

  await page.goto(`${tripUrl}/group`);
  await page.getByRole("button", { name: /Invite friends/ }).click();
  await page.getByRole("button", { name: "Create invite link" }).click();
  const invite = await page.getByLabel("Invite link").inputValue({ timeout: 10000 });
  check("invite link is created", invite.includes("/invite/"));

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/signup?next=${encodeURIComponent(new URL(invite).pathname)}`);
  await p2.getByLabel("Your name").fill("Friend");
  await p2.getByLabel("Email").fill(`friend-${tag}@example.com`);
  await p2.getByLabel("Password").fill("correct-horse-battery");
  await p2.getByRole("button", { name: "Create account" }).click();
  await p2.waitForURL(/onboarding/);
  await p2.getByRole("button", { name: "Skip for now" }).click();
  await p2.waitForURL(/\/invite\//);
  await p2.getByRole("button", { name: "Join this trip" }).click();
  await p2.waitForURL(/\/group/);
  check("second user joins through the invite", await seen(p2.getByText("2 members")));
  check("member can open the document", (await ctx2.request.get(docUrl)).status() === 200);

  const ctx3 = await browser.newContext();
  const p3 = await ctx3.newPage();
  await p3.goto(`${BASE}/signup`);
  await p3.getByLabel("Your name").fill("Stranger");
  await p3.getByLabel("Email").fill(`stranger-${tag}@example.com`);
  await p3.getByLabel("Password").fill("correct-horse-battery");
  await p3.getByRole("button", { name: "Create account" }).click();
  await p3.waitForURL(/onboarding/);
  check("stranger cannot download the document", (await ctx3.request.get(docUrl)).status() === 404);
  await p3.goto(`${BASE}/profile/billing`);
  check("plan switcher is not offered outside demo mode", (await p3.getByText("Development only").count()) === 0);

  await page.goto(`${BASE}/profile`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(BASE + "/");
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(`owner-${tag}@example.com`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/home/);
  check("sign out and sign back in", await seen(page.getByRole("heading", { name: "Tokyo getaway" })));
} catch (e) {
  console.error("ABORTED:", e.message.split("\n").slice(0, 5).join("\n"));
  failed++;
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} check(s) failed` : "\nAll hosted-mode checks passed");
process.exit(failed ? 1 : 0);
