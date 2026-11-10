// Fantasy Prediction — Chelsea (Liga Surpresa) Scriptable widget
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

function looksValid(data) {
  if (!data) return false
  if (data.tour != null) return true
  if (data.opponent) return true
  if (data.matches && data.matches.length) return true
  return false
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
    if (looksValid(data)) {
      return data
    }
    errors.push("api: empty")
  } catch (e) {
    errors.push("api: " + e)
  }

  try {
    const cdnUrl =
      "https://cdn.jsdelivr.net/gh/" +
      REPO +
      "@main/chelsea-tour.json?t=" +
      stamp
    const req = new Request(cdnUrl)
    req.timeoutInterval = 20
    req.headers = {
      "Cache-Control": "no-cache",
      "User-Agent": "Scriptable-FantasyChelsea"
    }
    const data = await req.loadJSON()
    if (looksValid(data)) {
      return data
    }
    errors.push("jsdelivr: empty")
  } catch (e) {
    errors.push("jsdelivr: " + e)
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
    if (looksValid(data)) {
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
  if (age < 60) return age + "c"
  if (age < 3600) return Math.round(age / 60) + "m"
  return Math.round(age / 3600) + "h"
}

function shortMatch(m) {
  let h = m.home || ""
  let a = m.away || ""
  h = h.replace(/\s+FC$/i, "").replace(/\s+CF$/i, "")
  a = a.replace(/\s+FC$/i, "").replace(/\s+CF$/i, "")
  if (h.length > 10) h = h.slice(0, 9) + "..."
  if (a.length > 10) a = a.slice(0, 9) + "..."
  return h + "-" + a
}

function statusLabel(m) {
  if (m.score) return m.score
  if (m.result && m.result !== "?" && m.result !== "-") return m.result
  if (m.time) return m.time
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

function addHeader(widget, title, rightText) {
  const header = widget.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()
  const t = header.addText(title)
  t.font = Font.boldSystemFont(12)
  t.textColor = new Color("#F0C040")
  header.addSpacer()
  if (rightText) {
    const r = header.addText(rightText)
    r.font = Font.systemFont(11)
    r.textColor = new Color("#94A3B8")
    header.addSpacer(6)
  }
  addRefreshButton(header)
}

function addDiffRow(widget, m, compact) {
  const row = widget.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  row.setPadding(2, 0, 2, 0)

  const my = row.addText(m.my || "-")
  my.font = Font.boldSystemFont(compact ? 12 : 13)
  my.textColor = new Color("#F0C040")
  my.monospacedDigit = true

  row.addSpacer(6)
  const name = row.addText(shortMatch(m))
  name.font = Font.systemFont(compact ? 11 : 12)
  name.textColor = Color.white()
  name.lineLimit = 1
  name.minimumScaleFactor = 0.7
  row.addSpacer()

  const opp = row.addText(m.opp || "-")
  opp.font = Font.boldSystemFont(compact ? 12 : 13)
  opp.textColor = new Color("#7DD3FC")
  opp.monospacedDigit = true

  row.addSpacer(8)
  const st = row.addText(statusLabel(m))
  st.font = Font.systemFont(10)
  st.textColor = m.pending ? new Color("#FBBF24") : new Color("#94A3B8")
  st.lineLimit = 1
  st.minimumScaleFactor = 0.6
}

async function createWidget(data, errorText) {
  const widget = new ListWidget()
  widget.setPadding(12, 14, 12, 14)
  widget.backgroundColor = new Color("#060E1C")
  const size = config.widgetFamily || "medium"

  if (errorText) {
    addHeader(widget, WIDGET_TITLE, "")
    widget.addSpacer(8)
    const err = widget.addText(String(errorText))
    err.font = Font.systemFont(12)
    err.textColor = new Color("#FF6B6B")
    err.minimumScaleFactor = 0.6
    err.lineLimit = 6
    widget.addSpacer()
    const hint = widget.addText("Tap Upd")
    hint.font = Font.systemFont(11)
    hint.textColor = new Color("#9CA3AF")
    widget.url = REFRESH_URL
    return widget
  }

  const tourLabel = data.tour != null ? "Tour " + data.tour : ""
  addHeader(widget, WIDGET_TITLE, tourLabel)
  widget.addSpacer(6)

  const vs = widget.addStack()
  vs.layoutHorizontally()
  vs.centerAlignContent()
  const oppName = vs.addText("vs " + (data.opponent || "?"))
  oppName.font = Font.semiboldSystemFont(size === "small" ? 14 : 15)
  oppName.textColor = Color.white()
  oppName.lineLimit = 1
  oppName.minimumScaleFactor = 0.7
  vs.addSpacer()
  const score = vs.addText(data.score || "-:-")
  score.font = Font.boldSystemFont(22)
  score.textColor = new Color("#F0C040")
  score.monospacedDigit = true

  const meta = widget.addStack()
  meta.layoutHorizontally()
  meta.centerAlignContent()
  const pending = Number(data.pending_diffs || 0)
  const diffs = data.diff_matches || []
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

  if (size === "small") {
    widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000)
    return widget
  }

  widget.addSpacer(8)
  const legend = widget.addStack()
  const l1 = legend.addText("Me")
  l1.font = Font.systemFont(10)
  l1.textColor = new Color("#F0C040")
  legend.addSpacer(10)
  const l2 = legend.addText("Opp")
  l2.font = Font.systemFont(10)
  l2.textColor = new Color("#7DD3FC")
  legend.addSpacer()
  const l3 = legend.addText("diffs only")
  l3.font = Font.systemFont(10)
  l3.textColor = new Color("#64748B")

  widget.addSpacer(4)
  const limit = size === "large" ? 12 : 6
  if (!diffs.length) {
    const empty = widget.addText("No differing tips")
    empty.font = Font.systemFont(12)
    empty.textColor = new Color("#64748B")
  } else {
    for (let i = 0; i < diffs.length && i < limit; i++) {
      addDiffRow(widget, diffs[i], size !== "large")
    }
    if (diffs.length > limit) {
      const more = widget.addText("+" + (diffs.length - limit) + " more")
      more.font = Font.systemFont(10)
      more.textColor = new Color("#64748B")
    }
  }

  if (size === "large") {
    widget.addSpacer(8)
    const allTitle = widget.addText("All tips")
    allTitle.font = Font.semiboldSystemFont(11)
    allTitle.textColor = new Color("#94A3B8")
    const all = data.matches || []
    let shown = 0
    for (let i = 0; i < all.length && shown < 10; i++) {
      const m = all[i]
      if (!m.active) continue
      shown++
      const row = widget.addStack()
      row.layoutHorizontally()
      row.centerAlignContent()
      const mark = row.addText(m.diff ? "*" : ".")
      mark.font = Font.systemFont(10)
      mark.textColor = m.diff ? new Color("#F0C040") : new Color("#334155")
      row.addSpacer(4)
      const my = row.addText((m.my || "-") + "/" + (m.opp || "-"))
      my.font = Font.semiboldSystemFont(11)
      my.textColor = m.diff ? Color.white() : new Color("#94A3B8")
      row.addSpacer(6)
      const nm = row.addText(shortMatch(m))
      nm.font = Font.systemFont(11)
      nm.textColor = new Color("#CBD5E1")
      nm.lineLimit = 1
      nm.minimumScaleFactor = 0.6
      row.addSpacer()
      const st = row.addText(statusLabel(m))
      st.font = Font.systemFont(10)
      st.textColor = new Color("#64748B")
    }
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
  await widget.presentMedium()
}
Script.complete()
