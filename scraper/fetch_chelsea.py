#!/usr/bin/env python3
"""Fetch Chelsea (Liga Surpresa) duel from Fantasy Prediction and write JSON."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

FANTASY_URL = os.environ.get(
    "FANTASY_URL",
    "https://script.google.com/macros/s/"
    "AKfycbwUbp3GLGPeNsAXxLmI3DrOg2Dhk5JdFZk7BNeZKYn-UdTOzl_CVZva6hzGsR1F79PTjg/exec",
)
TEAM = os.environ.get("TEAM", "Chelsea")
LEAGUE = os.environ.get("LEAGUE", "Liga Surpresa")
VALID_PREDS = {"1", "X", "2"}


def build_active_set(results: list[Any]) -> set[int]:
    """Mirror Fantasy Prediction buildActiveSet (main 10 + reserve substitutes)."""
    active: set[int] = set()
    ri = 10
    for i in range(10):
        if i >= len(results):
            break
        if results[i] == "-":
            while ri < 15 and ri < len(results) and results[ri] == "-":
                ri += 1
            if ri < 15 and ri < len(results):
                active.add(ri)
                ri += 1
        else:
            active.add(i)
    return active


def norm(s: Any) -> str:
    return str(s or "").strip()


def norm_league(s: Any) -> str:
    return norm(s).lower()


def find_duel(data: dict[str, Any], team: str, league: str) -> dict[str, Any] | None:
    teams = data.get("teams") or {}
    want_team = norm(team).lower()
    want_league = norm_league(league)
    for duel in data.get("duels") or []:
        home = norm(duel.get("home"))
        away = norm(duel.get("away"))
        if want_team not in {home.lower(), away.lower()}:
            continue
        home_info = teams.get(home) or teams.get(duel.get("home")) or {}
        away_info = teams.get(away) or teams.get(duel.get("away")) or {}
        lg = norm_league(home_info.get("league") or away_info.get("league"))
        if want_league and lg != want_league:
            continue
        return duel
    return None


def pred_for(predictions: list[dict[str, Any]], team_name: str) -> list[str]:
    for row in predictions or []:
        if norm(row.get("team")).lower() == norm(team_name).lower():
            preds = row.get("preds") or []
            return [norm(p).upper() for p in preds]
    return []


def calc_score(
    my_preds: list[str],
    opp_preds: list[str],
    matches: list[dict[str, Any]],
    active: set[int],
    has_mine: bool,
    has_opp: bool,
) -> str:
    if not has_mine and not has_opp:
        return "-:-"
    if has_mine and not has_opp:
        return "3:0"
    if has_opp and not has_mine:
        return "0:3"

    s1 = s2 = 0
    for i in active:
        if i >= len(matches):
            continue
        r = norm(matches[i].get("result")).upper()
        if not r or r in {"-", "?"}:
            continue
        h1 = i < len(my_preds) and my_preds[i] == r
        h2 = i < len(opp_preds) and opp_preds[i] == r
        if h1 and not h2:
            s1 += 1
        if h2 and not h1:
            s2 += 1
    return f"{s1}:{s2}"


def pending_diff_count(
    my_preds: list[str],
    opp_preds: list[str],
    matches: list[dict[str, Any]],
    active: set[int],
) -> int:
    count = 0
    for i in active:
        if i >= len(matches):
            continue
        result = norm(matches[i].get("result")).upper()
        if result and result != "?":
            continue
        first = my_preds[i] if i < len(my_preds) else ""
        second = opp_preds[i] if i < len(opp_preds) else ""
        if first in VALID_PREDS and second in VALID_PREDS and first != second:
            count += 1
    return count


def build_payload(tour: int, data: dict[str, Any], team: str, league: str) -> dict[str, Any]:
    duel = find_duel(data, team, league)
    now = datetime.now(timezone.utc)
    base = {
        "tour": tour,
        "team": team,
        "league": league,
        "updated_at": now.timestamp(),
        "updated_at_iso": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "fantasy-prediction",
    }
    if not duel:
        base.update(
            {
                "error": f"Duel not found for {team} in {league}",
                "opponent": None,
                "side": None,
                "score": "-:-",
                "pending_diffs": 0,
                "matches": [],
                "diff_matches": [],
            }
        )
        return base

    home = norm(duel.get("home"))
    away = norm(duel.get("away"))
    side = "home" if home.lower() == team.lower() else "away"
    opponent = away if side == "home" else home

    predictions = data.get("predictions") or []
    my_preds = pred_for(predictions, team)
    opp_preds = pred_for(predictions, opponent)
    has_mine = any(norm(p.get("team")).lower() == team.lower() for p in predictions)
    has_opp = any(norm(p.get("team")).lower() == opponent.lower() for p in predictions)

    matches = data.get("matches") or []
    results = [m.get("result") for m in matches]
    active = build_active_set(results)

    # Score from Chelsea's perspective (my goals : opponent goals)
    score = calc_score(my_preds, opp_preds, matches, active, has_mine, has_opp)

    rows: list[dict[str, Any]] = []
    for i, m in enumerate(matches):
        my = my_preds[i] if i < len(my_preds) else ""
        opp = opp_preds[i] if i < len(opp_preds) else ""
        result = norm(m.get("result")).upper()
        is_active = i in active
        is_diff = (
            is_active
            and my in VALID_PREDS
            and opp in VALID_PREDS
            and my != opp
        )
        played = bool(result) and result not in {"-", "?", ""}
        if result == "-:-":
            played = False
        rows.append(
            {
                "i": i,
                "home": norm(m.get("home")),
                "away": norm(m.get("away")),
                "time": norm(m.get("time")),
                "result": result,
                "score": (
                    f"{m.get('sh')}:{m.get('sa')}"
                    if played and m.get("sh") is not None and m.get("sa") is not None
                    else None
                ),
                "my": my,
                "opp": opp,
                "diff": is_diff,
                "active": is_active,
                "reserve": i >= 10,
                "pending": is_active and (not result or result == "?"),
            }
        )

    base.update(
        {
            "opponent": opponent,
            "side": side,
            "home": home,
            "away": away,
            "score": score,
            "pending_diffs": pending_diff_count(my_preds, opp_preds, matches, active),
            "has_my_ticket": has_mine,
            "has_opp_ticket": has_opp,
            "matches": rows,
            "diff_matches": [r for r in rows if r["diff"]],
        }
    )
    return base


RPC_JS = """
async () => {
  function run(name, ...args) {
    return new Promise((resolve, reject) => {
      try {
        const runner = google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler((err) => reject(err && err.message ? err : String(err)));
        if (typeof runner[name] !== 'function') {
          reject('Missing function: ' + name);
          return;
        }
        runner[name](...args);
      } catch (e) {
        reject(String(e));
      }
    });
  }
  const tours = await run('getTours');
  if (!tours || !tours.length) throw new Error('No tours');
  if (tours.error) throw new Error(tours.error);
  const tour = parseInt(tours[tours.length - 1], 10);
  const data = await run('getTourData', tour);
  if (!data || data.error) throw new Error((data && data.error) || 'Empty tour data');
  return { tour, data };
}
"""


def find_app_frame(page):
    """Return the Apps Script sandbox frame that hosts google.script.run."""
    deadline = time.time() + 90
    while time.time() < deadline:
        for frame in page.frames:
            url = frame.url or ""
            if "googleusercontent.com" in url or "sandboxFrame" in (frame.name or ""):
                try:
                    has_run = frame.evaluate(
                        "() => !!(window.google && google.script && google.script.run)"
                    )
                except Exception:
                    has_run = False
                if has_run:
                    return frame
        page.wait_for_timeout(500)
    raise RuntimeError("Apps Script sandbox frame with google.script.run not found")


def fetch_tour_data(headless: bool = True) -> tuple[int, dict[str, Any]]:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="uk-UA",
        )
        page = context.new_page()
        page.goto(FANTASY_URL, wait_until="domcontentloaded", timeout=120_000)
        # Outer shell loads iframe asynchronously
        page.wait_for_timeout(2000)
        try:
            page.wait_for_selector("#sandboxFrame", timeout=60_000)
        except Exception:
            pass

        frame = find_app_frame(page)
        # Give the HTML service a moment to finish bootstrapping
        frame.wait_for_timeout(1500)
        result = frame.evaluate(RPC_JS)
        browser.close()

    tour = int(result["tour"])
    data = result["data"]
    return tour, data


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch Chelsea Fantasy duel JSON")
    parser.add_argument(
        "-o",
        "--output",
        default=str(Path(__file__).resolve().parents[1] / "chelsea-tour.json"),
        help="Output JSON path",
    )
    parser.add_argument("--headed", action="store_true", help="Run browser headed")
    parser.add_argument("--team", default=TEAM)
    parser.add_argument("--league", default=LEAGUE)
    parser.add_argument(
        "--from-file",
        help="Skip Playwright; build payload from a saved getTourData JSON "
        '(expects {"tour": N, "data": {...}} or raw tour data + --tour)',
    )
    parser.add_argument("--tour", type=int, help="Tour number when using --from-file raw data")
    args = parser.parse_args()

    if args.from_file:
        raw = json.loads(Path(args.from_file).read_text(encoding="utf-8"))
        if isinstance(raw, dict) and "data" in raw and "tour" in raw:
            tour, data = int(raw["tour"]), raw["data"]
        else:
            if args.tour is None:
                print("--tour required for raw --from-file", file=sys.stderr)
                return 2
            tour, data = args.tour, raw
    else:
        print(f"Fetching from {FANTASY_URL} ...", flush=True)
        tour, data = fetch_tour_data(headless=not args.headed)
        print(f"Got tour {tour}, duels={len(data.get('duels') or [])}", flush=True)

    payload = build_payload(tour, data, args.team, args.league)
    out = Path(args.output)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out}")
    if payload.get("error"):
        print("WARN:", payload["error"], file=sys.stderr)
        return 1
    print(
        f"{payload['team']} vs {payload['opponent']}  "
        f"{payload['score']}  diffs={len(payload['diff_matches'])}  "
        f"pending={payload['pending_diffs']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
