"""Drives the web UI in headless Chrome and saves screenshots for the report.
Requires: pip install playwright, Chrome installed, Ganache + `npm run serve` running."""
import sys
from playwright.sync_api import sync_playwright

OUT = "screenshots"
DOC = "Bachelor of Data Science - Tran Bao Duy"

def shot(page, name):
    page.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    print("saved", name)

def status(page):
    return page.locator("#status").inner_text()

def wait_done(page):
    page.wait_for_function("() => { const s=document.getElementById('status'); return s.className.includes('success') || s.className.includes('error'); }", timeout=20000)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    page = b.new_page(viewport={"width": 1100, "height": 900})
    page.on("pageerror", lambda e: print("PAGE ERROR:", e))
    page.goto("http://localhost:8080/")
    page.wait_for_selector("#accountSelect option", state="attached")

    def connect(idx):
        page.select_option("#accountSelect", str(idx))
        page.click("#connectBtn")
        page.wait_for_function("() => document.getElementById('status').textContent.startsWith('Connected') || document.getElementById('status').className.includes('error')")

    # 1. issuer (account #0) connects
    connect(0); shot(page, "01-connected-issuer")

    # 2. issue
    page.fill("#issueId", "DTU-2026-0001")
    page.click("#fillRecipient")
    page.fill("#issueText", DOC)
    page.click("#issueBtn"); wait_done(page); print("ISSUE:", status(page).splitlines()[0])
    shot(page, "02-issued")

    # 3. verify (correct document)
    page.fill("#verifyId", "DTU-2026-0001"); page.fill("#verifyText", DOC)
    page.click("#verifyBtn"); page.wait_for_selector("#verifyResult .badge")
    print("VERIFY OK:", page.locator("#verifyResult").inner_text().replace("\n", " | ")[:140])
    shot(page, "03-verify-valid")

    # 4. verify tampered document
    page.fill("#verifyText", DOC + " (edited)")
    page.click("#verifyBtn"); page.wait_for_timeout(800)
    print("VERIFY TAMPERED:", page.locator("#verifyResult").inner_text().replace("\n", " | ")[:140])
    shot(page, "04-verify-tampered")

    # 5. duplicate ID rejected
    page.fill("#issueId", "DTU-2026-0001")
    page.click("#issueBtn"); wait_done(page); print("DUPLICATE:", status(page).splitlines()[1])
    shot(page, "05-rejected-duplicate")

    # 6. second account (#2, not issuer) tries to revoke -> rejected
    connect(2)
    print("ROLE:", page.locator("#roleInfo").inner_text())
    page.fill("#revokeId", "DTU-2026-0001")
    page.click("#revokeBtn"); wait_done(page); print("UNAUTHORIZED:", status(page).splitlines()[1])
    shot(page, "06-rejected-unauthorized")

    # 7. issuer revokes
    connect(0)
    page.fill("#revokeId", "DTU-2026-0001")
    page.click("#revokeBtn"); wait_done(page); print("REVOKE:", status(page).splitlines()[0])
    shot(page, "07-revoked")

    # 8. verify again -> not valid
    page.fill("#verifyId", "DTU-2026-0001"); page.fill("#verifyText", DOC)
    page.click("#verifyBtn"); page.wait_for_timeout(800)
    print("VERIFY AFTER REVOKE:", page.locator("#verifyResult").inner_text().replace("\n", " | ")[:140])
    shot(page, "08-verify-revoked")
    b.close()
