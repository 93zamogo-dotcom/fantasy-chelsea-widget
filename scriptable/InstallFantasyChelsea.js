// Install FantasyChelsea from GitHub. Paste this ONLY and press Play.
const NAME = "FantasyChelsea"
const URL = "https://raw.githubusercontent.com/93zamogo-dotcom/fantasy-chelsea-widget/main/scriptable/FantasyChelsea.js"

const req = new Request(URL)
req.timeoutInterval = 30
const code = await req.loadString()
if (!code || code.indexOf("fetchStatus") < 0) {
  throw new Error("Download failed")
}

const fm = FileManager.iCloud()
const path = fm.joinPath(fm.documentsDirectory(), NAME + ".js")
fm.writeString(path, code)

const a = new Alert()
a.title = "OK"
a.message = "FantasyChelsea installed. Open it, press Play, add Large widget."
a.addAction("Open")
await a.present()
Safari.open("scriptable:///open/" + encodeURIComponent(NAME))
Script.complete()
