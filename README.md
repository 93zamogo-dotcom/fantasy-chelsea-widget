# Fantasy Chelsea — iPhone Scriptable widget

Віджет для **Chelsea** у **Liga Surpresa**. Показує рахунок дуелі та матчі, де твій прогноз і прогноз опонента **різняться**.

## Як працює

1. GitHub Actions відкриває Fantasy Prediction (Playwright) і викликає `getTourData`
2. Основний workflow оновлює ~кожні 5–15 хв (кілька overlapping cron)
3. Watchdog кожні ~10 хв: якщо файл старший за 25 хв — оновлює сам
4. iPhone читає `chelsea-tour.json` (GitHub API → jsDelivr → raw)

Mac не потрібен.

## Setup

1. Public GitHub-репозиторій: `93zamogo-dotcom/fantasy-chelsea-widget`
2. Actions → **Update Chelsea tour** → Run workflow (один раз)
3. У Scriptable встав код з [`scriptable/FantasyChelsea.js`](scriptable/FantasyChelsea.js) і додай віджет **Medium**

## Локально

```bash
cd scraper
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
python fetch_chelsea.py -o ../chelsea-tour.json
```
