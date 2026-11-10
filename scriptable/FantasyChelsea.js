// Fantasy Chelsea widget (Large)
const REPO = "93zamogo-dotcom/fantasy-chelsea-widget"
const WIDGET_TITLE = "Chelsea"
const REFRESH_URL = "scriptable:///run?scriptName=" + encodeURIComponent(Script.name())

function decodeBase64(b64) {
  const cleaned = b64.replace(/\n/g, "")
  const data = Data.fromBase64String(cleaned)
  if (!data) {
    throw new Error("base64 decode failed")
  }
  return data.toRawString()
}

async function fetchStatus() {
  const stamp = Date.now()
  const errors = []

  try {
    const apiUrl =
      "https://api.github.com/repos/" +
      REPO +
      "/contents/chelsea-tour.json?ref=main&ts=" +
      stamp
    const req = new Request(apiUrl)
    req.timeoutInterval = 20
    req.headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Scriptable-FantasyChelsea",
      "Cache-Control": "no-cache"
    }
    const payload = await req.loadJSON()
    let data = payload
    if (
      payload &&
      typeof payload.content === "string" &&
      payload.encoding === "base64"
    ) {
      data = JSON.parse(decodeBase64(payload.content))
    }
    if (data && (data.tour != null || data.opponent || data.matches)) {
      return data
    }
    errors.push("api: empty")
  } catch (e) {
    errors.push("api: " + e)
  }

  try {
    const rawUrl =
      "https://raw.githubusercontent.com/" +
      REPO +
      "/main/chelsea-tour.json?ts=" +
      stamp
    const req = new Request(rawUrl)
    req.timeoutInterval = 20
    req.headers = {
      "Cache-Control": "no-cache",
      "User-Agent": "Scriptable-FantasyChelsea"
    }
    const data = await req.loadJSON()
    if (data && (data.tour != null || data.opponent || data.matches)) {
      return data
    }
    errors.push("raw: empty")
  } catch (e) {
    errors.push("raw: " + e)
  }

  throw new Error(errors.join(" | ") || "fetch failed")
}

function fmtAge(updatedAt) {
  if (!updatedAt) return ""
  const age = Math.max(0, Math.round(Date.now() / 1000 - Number(updatedAt)))
  if (age < 60) return age + "s"
  if (age < 3600) return Math.round(age / 60) + "m"
  return Math.round(age / 3600) + "h"
}

function shortName(name) {
  let s = String(name || "")
  if (s.length > 12) s = s.slice(0, 11) + "."
  return s
}

function matchLabel(m) {
  return shortName(m.home) + " v " + shortName(m.away)
}

function resultLabel(m) {
  if (m.score) return String(m.score)
  if (m.time) return String(m.time)
  return "..."
}

function addRefreshButton(parent) {
  const btn = parent.addStack()
  btn.layoutHorizontally()
  btn.centerAlignContent()
  btn.setPadding(3, 7, 3, 7)
  btn.cornerRadius = 7
  btn.backgroundColor = new Color("#1A2640")
  btn.url = REFRESH_URL
  const label = btn.addText("Upd")
  label.font = Font.semiboldSystemFont(11)
  label.textColor = new Color("#F0C040")
}

function addDiffRow(widget, m) {
  const line = widget.addStack()
  line.layoutHorizontally()
  line.centerAlignContent()
  line.setPadding(2, 0, 2, 0)

  const my = line.addText(String(m.my || "?"))
  my.font = Font.boldSystemFont(14)
  my.textColor = new Color("#F0C040")

  line.addSpacer(8)
  const name = line.addText(matchLabel(m))
  name.font = Font.systemFont(12)
  name.textColor = Color.white()
  name.lineLimit = 1
  name.minimumScaleFactor = 0.6
  line.addSpacer()

  const their = line.addText(String(m.opp || "?"))
  their.font = Font.boldSystemFont(14)
  their.textColor = new Color("#7DD3FC")

  line.addSpacer(8)
  const st = line.addText(resultLabel(m))
  st.font = Font.systemFont(11)
  st.textColor = m.pending ? new Color("#FBBF24") : new Color("#94A3B8")
  st.lineLimit = 1
}

function addAllRow(widget, m) {
  const line = widget.addStack()
  line.layoutHorizontally()
  line.centerAlignContent()
  line.setPadding(1, 0, 1, 0)

  const mark = line.addText(m.diff ? "*" : ".")
  mark.font = Font.systemFont(11)
  mark.textColor = m.diff ? new Color("#F0C040") : new Color("#334155")
  line.addSpacer(4)

  const preds = line.addText(String(m.my || "?") + "/" + String(m.opp || "?"))
  preds.font = Font.semiboldSystemFont(12)
  preds.textColor = m.diff ? Color.white() : new Color("#94A3B8")
  line.addSpacer(8)

  const name = line.addText(matchLabel(m))
  name.font = Font.systemFont(11)
  name.textColor = new Color("#CBD5E1")
  name.lineLimit = 1
  name.minimumScaleFactor = 0.6
  line.addSpacer()

  const st = line.addText(resultLabel(m))
  st.font = Font.systemFont(10)
  st.textColor = new Color("#64748B")
}

async function createWidget(data, errorText) {
  const widget = new ListWidget()
  widget.setPadding(12, 14, 12, 14)
  widget.backgroundColor = new Color("#060E1C")

  const header = widget.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()
  const title = header.addText(WIDGET_TITLE)
  title.font = Font.boldSystemFont(12)
  title.textColor = new Color("#F0C040")
  header.addSpacer()
  if (data && data.tour != null) {
    const tour = header.addText("Tour " + data.tour)
    tour.font = Font.systemFont(11)
    tour.textColor = new Color("#94A3B8")
    header.addSpacer(6)
  }
  addRefreshButton(header)

  widget.addSpacer(6)

  if (errorText) {
    const err = widget.addText(String(errorText))
    err.font = Font.systemFont(12)
    err.textColor = new Color("#FF6B6B")
    err.minimumScaleFactor = 0.6
    err.lineLimit = 8
    widget.addSpacer()
    const hint = widget.addText("Tap Upd")
    hint.font = Font.systemFont(11)
    hint.textColor = new Color("#9CA3AF")
    widget.url = REFRESH_URL
    return widget
  }

  const row = widget.addStack()
  row.centerAlignContent()
  const opp = row.addText("vs " + (data.opponent || "?"))
  opp.font = Font.semiboldSystemFont(15)
  opp.textColor = Color.white()
  opp.lineLimit = 1
  opp.minimumScaleFactor = 0.6
  row.addSpacer()
  const score = row.addText(String(data.score || "0:0"))
  score.font = Font.boldSystemFont(24)
  score.textColor = new Color("#F0C040")

  const diffs = data.diff_matches || []
  const meta = widget.addStack()
  meta.layoutHorizontally()
  meta.centerAlignContent()
  const pending = Number(data.pending_diffs || 0)
  if (pending > 0) {
    const live = meta.addText("LIVE " + pending)
    live.font = Font.semiboldSystemFont(11)
    live.textColor = new Color("#F87171")
  } else {
    const idle = meta.addText(diffs.length + " diffs")
    idle.font = Font.systemFont(11)
    idle.textColor = new Color("#94A3B8")
  }
  meta.addSpacer()
  const age = meta.addText(fmtAge(data.updated_at))
  age.font = Font.systemFont(10)
  age.textColor = new Color("#64748B")

  widget.addSpacer(8)
  const legend = widget.addStack()
  const me = legend.addText("Me")
  me.font = Font.systemFont(10)
  me.textColor = new Color("#F0C040")
  legend.addSpacer(8)
  const oppL = legend.addText("Opp")
  oppL.font = Font.systemFont(10)
  oppL.textColor = new Color("#7DD3FC")
  legend.addSpacer()
  const only = legend.addText("diffs")
  only.font = Font.systemFont(10)
  only.textColor = new Color("#64748B")

  widget.addSpacer(4)
  if (!diffs.length) {
    const empty = widget.addText("No diffs")
    empty.font = Font.systemFont(12)
    empty.textColor = new Color("#64748B")
  } else {
    for (let i = 0; i < diffs.length && i < 8; i++) {
      addDiffRow(widget, diffs[i])
    }
  }

  widget.addSpacer(8)
  const allTitle = widget.addText("All tips")
  allTitle.font = Font.semiboldSystemFont(11)
  allTitle.textColor = new Color("#94A3B8")

  const all = data.matches || []
  let shown = 0
  for (let i = 0; i < all.length && shown < 10; i++) {
    const m = all[i]
    if (!m.active) continue
    shown = shown + 1
    addAllRow(widget, m)
  }

  widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000)
  return widget
}

let widget
try {
  const data = await fetchStatus()
  widget = await createWidget(data, null)
} catch (err) {
  widget = await createWidget(null, err)
}

Script.setWidget(widget)
if (!config.runsInWidget) {
  await widget.presentLarge()
}
Script.complete()
