"""Headless smoke test for Bubu & Dudu Jump.

Boots the game on a phone-sized viewport, drives it with a simple bot that
steers toward the next platform, and fails on any console error or if the bot
cannot sustain a climb (which would mean the platform spacing is unplayable).
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8911/?debug"
errors = []

# Greedy bot: predict the jump apex, then aim for the highest platform that
# still sits below it (i.e. the best one we can actually land on).
PICK_TARGET = """() => {
  const g = window.__bdj;
  if (!g || !g.playing) return null;
  const p = g.player;
  const FEET = 42 / 2 * 1.2;
  const apex = p.vy < 0 ? p.y - (p.vy * p.vy) / (2 * 0.42) : p.y;
  const floor = apex + FEET + 4;
  let best = null;
  for (const pl of g.platforms) {
    if (pl.broken || pl.type === 'break') continue;
    if (pl.y < floor) continue;                    // above the apex: unreachable
    if (!best || pl.y < best.y) best = pl;         // highest reachable one
  }
  return { px: p.x, vx: p.vx, tx: best ? best.x + best.w / 2 : null, score: g.score };
}"""


def run(page, seconds, label):
    """Hold the correct screen half each tick so the bot lands on platforms."""
    held = False
    ticks = int(seconds * 1000 / 60)
    for i in range(ticks):
        t = page.evaluate(PICK_TARGET)
        if t is None:
            break
        if t["tx"] is None:
            dx = 0
        else:
            # aim slightly ahead of current drift so we settle on the pad
            dx = (t["tx"] - t["px"]) - t["vx"] * 6
        want = 0 if abs(dx) < 12 else (1 if dx > 0 else -1)
        x = 320 if want > 0 else 70
        if want == 0:
            if held:
                page.mouse.up(); held = False
        else:
            if held:
                page.mouse.move(x, 620)
            else:
                page.mouse.move(x, 620); page.mouse.down(); held = True
        page.wait_for_timeout(60)
    if held:
        page.mouse.up()
    return page.evaluate("() => window.__bdj.score")


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3,
        is_mobile=True,
        has_touch=True,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                   "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    )
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(700)
    page.screenshot(path=".dev/shot-menu.png")

    page.click('.char-card[data-char="bubu"]')
    page.wait_for_timeout(250)
    page.click("#playBtn")
    page.wait_for_timeout(800)

    score = run(page, 25, "climb")
    page.screenshot(path=".dev/shot-play.png")
    print("bot score after 25s:", score)

    # pause / resume
    page.click("#pauseBtn")
    page.wait_for_timeout(300)
    paused_ok = page.is_visible("#resumeBtn")
    page.screenshot(path=".dev/shot-paused.png")
    page.click("#resumeBtn")
    page.wait_for_timeout(300)
    print("pause overlay:", paused_ok, "| resumed:", page.evaluate("() => window.__bdj.playing"))

    # drop the player off the bottom to exercise the game-over path
    page.evaluate("() => { window.__bdj.player.y = window.__bdj.VH + 200; }")
    for _ in range(40):
        page.wait_for_timeout(100)
        if not page.evaluate("() => window.__bdj.playing"):
            break
    page.wait_for_timeout(400)
    over = page.is_visible("#gameover")
    page.screenshot(path=".dev/shot-gameover.png")
    print("game over shown:", over, "| final:", page.inner_text("#goScore"), "| best:", page.inner_text("#goBest"))

    if page.is_visible("#menuBtn"):
        page.click("#menuBtn")
        page.wait_for_timeout(500)
        page.screenshot(path=".dev/shot-menu-after.png")

    browser.close()

if errors:
    print("ERRORS:\n" + "\n".join(errors))
    sys.exit(1)
if score < 90:
    print(f"FAIL: bot only climbed {score} m in 25s — platform spacing is likely unplayable")
    sys.exit(1)
print("no console errors")
