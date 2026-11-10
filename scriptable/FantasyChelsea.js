// Fantasy Prediction — Chelsea (Liga Surpresa) Scriptable widget
// Reads chelsea-tour.json updated by GitHub Actions (Mac не потрібен)
const REPO = "93zamogo-dotcom/fantasy-chelsea-widget"
const WIDGET_TITLE = "Chelsea"
const REFRESH_URL = "scriptable:///run?scriptName=" + encodeURIComponent(Script.name())

function decodeBase64(b64) {
  const cleaned = b64.replace(/\n/g, "")
  const data = Data.fromBase64String(cleaned)
  if (!data) throw new Error("base64 decode failed")
  return data.toRawString()
}

function looksValid(data) {
  return data && (data.tour != null || data.opponent || (data.matches && data.matches.length))
}

async function fetchStatus() {
  const stamp = Date.now()
  const errors = []
  const candidates = [
    {
      name: "api",
      url:
        "https://api.github.com/repos/" +
        REPO +
        "/contents/chelsea-tour.json?ref=main&ts=" +
        stamp,
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Scriptable-FantasyChelsea",
        "Cache-Control": "no-cache"
      },
      parse: async (req) => {
        const payload = await req.loadJSON()
        if (
          payload &&
          typeof payload.content === "string" &&
          payload.encoding === "base64"
        ) {
          return JSON.parse(decodeBase64(payload.content))
        }
        return payload
      }
    },
    {
      name: "jsdelivr",
      url:
        "https://cdn.jsdelivr.net/gh/" +
        REPO +
        "@main/chelsea-tour.json?t=" +
        stamp,
      headers: {
        "Cache-Control": "no-cache",
        "User-Agent": "Scriptable-FantasyChelsea"
      },
      parse: (req) => req.loadJSON()
    },
    {
      name: "raw",
      url:
        "https://raw.githubusercontent.com/" +
        REPO +
        "/main/chelsea-tour.json?ts=" +
        stamp,
      headers: {
        "Cache-Control": "no-cache",
        "User-Agent": "Scriptable-FantasyChelsea"
      },
      parse: (req) => req.loadJSON()
    }
  ]

  for (const c of candidates) {
    try {
      const req = new Request(c.url)
      req.timeoutInterval = 20
      req.headers = c.headers
      const data = await c.parse(req)
      if (looksValid(data)) return data
      errors.push(c.name + ": empty")
    } catch (e) {
      errors.push(c.name + ": " + e)
    }
  }
  throw new Error(errors.join(" | ") || "fetch failed")
}

function fmtAge(updatedAt) {
  if (!updatedAt) return ""
  const age = Math.max(0, Math.round(Date.now() / 1000 - Number(updatedAt)))
  if (age < 60) return age + "с"
  if (age < 3600) return Math.round(age / 60) + "м"
  return Math.round(age / 3600) + "ч"
}

function shortMatch(m) {
  const h = (m.home || "").replace(/\s+FC$/i, "").replace(/\s+CF$/i, "")
  const a = (m.away || "").replace(/\s+FC$/i, "").replace(/\s+CF$/i, "")
  const trim = (s) => (s.length > 10 ? s.slice(0, 9) + "…" : s)
  return trim(h) + "–" + trim(a)
}

function statusLabel(m) {
  if (m.score) return m.score
  if (m.result && m.result !== "?" && m.result !== "-") return m.result
  if (m.time) return m.time
  return "…"
}

function addRefreshButton(parent) {
  const btn = parent.addStack()
  btn.layoutHorizontally()
  btn.centerAlignContent()
  btn.setPadding(3, 7, 3, 7)
  btn.cornerRadius = 7
  btn.backgroundColor = new Color("#1A2640")
  btn.url = REFRESH_URL
  const label = btn.addText("↻")
  label.font = Font.semiboldSystemFont(12)
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

  const my = row.addText(m.my || "–")
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

  const opp = row.addText(m.opp || "–")
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
    const hint = widget.addText("Натисни ↻")
    hint.font = Font.systemFont(11)
    hint.textColor = new Color("#9CA3AF")
    widget.url = REFRESH_URL
    return widget
  }

  const tourLabel = data.tour != null ? "Тур " + data.tour : ""
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
  if (pending > 0) {
    const live = meta.addText("LIVE · " + pending + " розбіжн.")
    live.font = Font.semiboldSystemFont(11)
    live.textColor = new Color("#F87171")
  } else {
    const idle = meta.addText(
      (data.diff_matches || []).length + " розбіжностей"
    )
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
  const l1 = legend.addText("Я")
  l1.font = Font.systemFont(10)
  l1.textColor = new Color("#F0C040")
  legend.addSpacer(10)
  const l2 = legend.addText("Опонент")
  l2.font = Font.systemFont(10)
  l2.textColor = new Color("#7DD3FC")
  legend.addSpacer()
  const l3 = legend.addText("лише розбіжності")
  l3.font = Font.systemFont(10)
  l3.textColor = new Color("#64748B")

  widget.addSpacer(4)
  const diffs = data.diff_matches || (data.matches || []).filter((m) => m.diff)
  const limit = size === "large" ? 12 : 6
  if (!diffs.length) {
    const empty = widget.addText("Немає розбіжних прогнозів")
    empty.font = Font.systemFont(12)
    empty.textColor = new Color("#64748B")
  } else {
    diffs.slice(0, limit).forEach((m) => addDiffRow(widget, m, size !== "large"))
    if (diffs.length > limit) {
      const more = widget.addText("+" + (diffs.length - limit) + " ще")
      more.font = Font.systemFont(10)
      more.textColor = new Color("#64748B")
    }
  }

  if (size === "large") {
    widget.addSpacer(8)
    const allTitle = widget.addText("Усі прогнози")
    allTitle.font = Font.semiboldSystemFont(11)
    allTitle.textColor = new Color("#94A3B8")
    const all = (data.matches || []).filter((m) => m.active)
    all.slice(0, 10).forEach((m) => {
      const row = widget.addStack()
      row.layoutHorizontally()
      row.centerAlignContent()
      const mark = row.addText(m.diff ? "●" : "·")
      mark.font = Font.systemFont(10)
      mark.textColor = m.diff ? new Color("#F0C040") : new Color("#334155")
      row.addSpacer(4)
      const my = row.addText((m.my || "–") + "/" + (m.opp || "–"))
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
    })
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
