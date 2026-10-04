// Captures the documentation screenshots (docs/screenshots/) with a headless
// copy of the system Chrome/Edge. Re-run after UI changes to refresh the
// images referenced by README.md and docs/USER_MANUAL.md:
//
//   node scripts/capture-doc-screenshots.mjs
//
// Captures at 1440x900 so the sidebar layout is included. Role homes,
// courses and the accreditation report are full-page; login, signup and the
// import dialog are viewport shots. The admin home masks any email text so
// no personal data lands in the repository.
import puppeteer from "puppeteer-core";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(repo, "docs", "screenshots");
mkdirSync(outDir, { recursive: true });

const BASE = process.env.SMOKE_BASE_URL || "https://nurselearn-ph.vercel.app";
const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find(existsSync);
if (!CHROME) {
  console.error("No Chrome/Edge installation found.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForPage(page, expression, timeout = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await page.evaluate(expression)) return true;
    } catch {
      /* navigation race - keep polling */
    }
    await sleep(250);
  }
  return false;
}

async function login(page, username, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!(await waitForPage(page, "document.querySelectorAll('input').length >= 2"))) {
    throw new Error(`login form did not render for ${username}`);
  }
  // React-controlled inputs: native setter + input event, then submit
  await page.evaluate(
    ([u, p]) => {
      const set = (el, v) => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const inputs = [...document.querySelectorAll("input")];
      const userInput = inputs.find((i) => /user|email/i.test(i.name + i.placeholder)) || inputs[0];
      const passInput = inputs.find((i) => i.type === "password");
      set(userInput, u);
      set(passInput, p);
      document.querySelector("form").requestSubmit();
    },
    [username, password]
  );
  const home = await waitForPage(page, "document.body.innerText.includes('Welcome,')", 45000);
  if (!home) {
    const body = await page.evaluate("document.body.innerText.slice(0, 300)");
    throw new Error(`login failed for ${username}: ${body.replace(/\s+/g, " ").trim()}`);
  }
  await sleep(2200); // let stat/count queries settle
}

async function shot(page, name, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  const path = resolve(outDir, `${name}.png`);
  await page.screenshot({ path, fullPage });
  console.log(`  saved ${name}.png`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--disable-gpu"],
});

// Optional filter: re-run only specific shots, e.g.
//   node scripts/capture-doc-screenshots.mjs home-admin login
const filter = process.argv.slice(2);
const want = (name) => filter.length === 0 || filter.includes(name);

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  console.log(`Capturing docs screenshots from ${BASE}`);

  // 1. Login page (the app's main page)
  if (want("login")) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForPage(page, "document.body.innerText.includes('Sign In')");
    await sleep(1500);
    await shot(page, "login");
  }

  // 2. Signup page
  if (want("signup")) {
    await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForPage(page, "!!document.querySelector('input[type=email]')");
    await sleep(1200);
    await shot(page, "signup");
  }

  // 3-6. Role homes (and coordinator-only pages while that session is open)
  const roles = [
    ["student", "newpass123", "home-student"],
    ["instructor", "instructor123", "home-instructor"],
    ["coordinator", "coordinator123", "home-coordinator"],
    ["admin", "admin123", "home-admin"],
  ].filter(([, , n]) => want(n));
  for (const [user, pass, name] of roles) {
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {
        /* about:blank has no storage - nothing to clear */
      }
    }).catch(() => {});
    await login(page, user, pass);

    if (name === "home-admin") {
      // Pending approvals show a real person's name and email - mask both
      await page.evaluate(() => {
        document.querySelectorAll("p").forEach((p) => {
          if (p.children.length === 0 && p.textContent.includes("@")) {
            p.textContent = "hidden@example.com";
            const parent = p.parentElement;
            const nameEl = parent
              ? [...parent.querySelectorAll("p, span, div")].find(
                  (e) => e !== p && e.children.length === 0 && e.textContent.trim() && !e.textContent.includes("Review")
                )
              : null;
            if (nameEl) nameEl.textContent = "Pending User";
          }
        });
      });
      await sleep(300);
    }
    await shot(page, name, true);

    if (name === "home-coordinator") {
      // Courses list
      await page.goto(`${BASE}/courses`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForPage(page, "[...document.querySelectorAll('table tbody tr')].some((tr) => /[A-Z]{3,}\\d/.test(tr.innerText))");
      await sleep(1200);
      await shot(page, "courses", true);

      // Enrollments import dialog (shows the Download template link)
      await page.goto(`${BASE}/enrollments`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForPage(page, "[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Import CSV'))");
      await page.evaluate(() =>
        [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Import CSV")).click()
      );
      await waitForPage(page, "document.body.innerText.includes('Import Roster (CSV)')");
      await sleep(1000);
      await shot(page, "enrollments-import");

      // Accreditation report (all sections loaded)
      await page.goto(`${BASE}/accreditation`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForPage(
        page,
        "document.querySelectorAll('table').length >= 5 && !document.querySelector('.animate-spin')",
        60000
      );
      await sleep(1800);
      await shot(page, "accreditation", true);
    }
  }

  const shots = roles.length + (want("login") ? 1 : 0) + (want("signup") ? 1 : 0) +
    (want("home-coordinator") ? 3 : 0);
  console.log(`Done - ${shots} screenshot(s) in docs/screenshots/`);
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
