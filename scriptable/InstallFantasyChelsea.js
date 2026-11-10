// Paste THIS short script into Scriptable and press Play.
// It downloads FantasyChelsea.js from GitHub (no broken copy-paste).
const NAME = "FantasyChelsea"
const URL =
  "https://raw.githubusercontent.com/93zamogo-dotcom/fantasy-chelsea-widget/main/scriptable/FantasyChelsea.js"

const req = new Request(URL)
req.timeoutInterval = 30
const code = await req.loadString()
if (!code || code.indexOf("fetchStatus") < 0) {
  throw new Error("Download failed")
}

const fm = FileManager.iCloud()
const path = fm.joinPath(fm.documentsDirectory(), NAME + ".js")
fm.writeString(path, code)

const alert = new Alert()
alert.title = "Installed"
alert.message = NAME + " saved. Open it and press Play, then add Medium widget."
alert.addAction("Open")
await alert.present()
Safari.open("scriptable:///open/" + encodeURIComponent(NAME))
Script.complete()
