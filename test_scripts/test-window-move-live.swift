// Live end-to-end test of the Move Window drag routine (mirrors WindowMover.moveWindow(byDesktops:)).
// WARNING: actually moves the focused window of the named app and follows it to the
// destination desktop. Usage:
//   test-window-move-live --list                      list desktops (global index, space id)
//   test-window-move-live --app TextEdit --dest 2     drag TextEdit window 2 desktops right (negative = left)
// Build: DEVELOPER_DIR=/Library/Developer/CommandLineTools swiftc -O -framework Cocoa \
//        -F /System/Library/PrivateFrameworks -o /tmp/wmlive test_scripts/test-window-move-live.swift
import Cocoa
import ApplicationServices

@_silgen_name("CGSMainConnectionID") func CGSMainConnectionID() -> Int32
@_silgen_name("CGSGetActiveSpace") func CGSGetActiveSpace(_ cid: Int32) -> Int
@_silgen_name("CGSCopyManagedDisplaySpaces") func CGSCopyManagedDisplaySpaces(_ cid: Int32) -> CFArray
typealias CGSSymbolicHotKey = UInt32
@_silgen_name("CGSGetSymbolicHotKeyValue")
func CGSGetSymbolicHotKeyValue(_ hotKey: CGSSymbolicHotKey, _ unknown: UnsafeMutableRawPointer?, _ keyCode: UnsafeMutablePointer<CGKeyCode>, _ modifiers: UnsafeMutablePointer<CGEventFlags>) -> Int32
@_silgen_name("CGSIsSymbolicHotKeyEnabled") func CGSIsSymbolicHotKeyEnabled(_ hotKey: CGSSymbolicHotKey) -> Bool
@_silgen_name("CGSSetSymbolicHotKeyEnabled") func CGSSetSymbolicHotKeyEnabled(_ hotKey: CGSSymbolicHotKey, _ enabled: Bool) -> Int32

func log(_ s: String) { print("[\(String(format: "%.3f", Date().timeIntervalSince1970.truncatingRemainder(dividingBy: 1000)))] \(s)") }

func listSpaces() -> [(global: Int, id: Int, display: String)] {
    let cid = CGSMainConnectionID()
    let displays = CGSCopyManagedDisplaySpaces(cid) as? [[String: Any]] ?? []
    var out: [(Int, Int, String)] = []
    var g = 0
    for d in displays {
        let ident = d["Display Identifier"] as? String ?? "?"
        for sp in d["Spaces"] as? [[String: Any]] ?? [] {
            guard (sp["type"] as? Int ?? 0) == 0 else { continue }
            g += 1
            out.append((g, sp["ManagedSpaceID"] as? Int ?? sp["id64"] as? Int ?? 0, ident))
        }
    }
    return out
}

let args = CommandLine.arguments
let active = CGSGetActiveSpace(CGSMainConnectionID())
log("active space id \(active)")
let spaces = listSpaces()
for s in spaces { log("desktop \(s.global): space \(s.id) \(s.id == active ? "<- current" : "") display \(s.display.prefix(8))") }
if args.contains("--list") { exit(0) }

guard let ai = args.firstIndex(of: "--app"), ai + 1 < args.count,
      let di = args.firstIndex(of: "--dest"), di + 1 < args.count, let dest = Int(args[di + 1]) else {
    log("need --app <name> --dest <globalIndex>"); exit(1)
}
guard let app = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == args[ai + 1] }) else {
    log("app \(args[ai + 1]) not running"); exit(1)
}
app.activate()
usleep(500_000)
log("frontmost now: \(NSWorkspace.shared.frontmostApplication?.localizedName ?? "?")")

let steps = abs(dest); let hk = CGSSymbolicHotKey(dest > 0 ? 81 : 79)
var keyCode: CGKeyCode = 0; var flags: CGEventFlags = []
let err = CGSGetSymbolicHotKeyValue(hk, nil, &keyCode, &flags)
log("hotkey \(hk): err \(err) keyCode \(keyCode) flags 0x\(String(flags.rawValue, radix: 16)) enabled \(CGSIsSymbolicHotKeyEnabled(hk))")

let appEl = AXUIElementCreateApplication(app.processIdentifier)
var winRef: CFTypeRef?
let r = AXUIElementCopyAttributeValue(appEl, kAXFocusedWindowAttribute as CFString, &winRef)
guard r == .success, let winRef else { log("no focused window: \(r.rawValue)"); exit(1) }
let window = winRef as! AXUIElement
var posRef: CFTypeRef?; AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &posRef)
var winPos = CGPoint.zero; if let p = posRef { AXValueGetValue(p as! AXValue, .cgPoint, &winPos) }
var sizeRef: CFTypeRef?; AXUIElementCopyAttributeValue(window, kAXSizeAttribute as CFString, &sizeRef)
var winSize = CGSize.zero; if let p = sizeRef { AXValueGetValue(p as! AXValue, .cgSize, &winSize) }
var mb: CFTypeRef?
var cursor = CGPoint(x: winPos.x + 40, y: winPos.y + 12)
if AXUIElementCopyAttributeValue(window, kAXMinimizeButtonAttribute as CFString, &mb) == .success {
    var bp: CFTypeRef?; AXUIElementCopyAttributeValue(mb as! AXUIElement, kAXPositionAttribute as CFString, &bp)
    var bpos = CGPoint.zero; if let p = bp { AXValueGetValue(p as! AXValue, .cgPoint, &bpos) }
    cursor = CGPoint(x: bpos.x, y: winPos.y + abs(winPos.y - bpos.y) / 2.0)
    log("window pos \(winPos) size \(winSize) minimize button \(bpos) -> cursor \(cursor)")
} else {
    log("window pos \(winPos) size \(winSize), no minimize button -> cursor \(cursor)")
}
let elAt = { () -> String in
    var el: AXUIElement?
    let sys = AXUIElementCreateSystemWide()
    var out: AXUIElement? = nil
    if AXUIElementCopyElementAtPosition(sys, Float(cursor.x), Float(cursor.y), &out) == .success, let out {
        var role: CFTypeRef?; AXUIElementCopyAttributeValue(out, kAXRoleAttribute as CFString, &role)
        var pid: pid_t = 0; AXUIElementGetPid(out, &pid)
        el = out
        return "\(role as? String ?? "?") pid \(pid)"
    }
    _ = el
    return "none"
}
log("element under cursor: \(elAt())")

let mk = { (t: CGEventType) in CGEvent(mouseEventSource: nil, mouseType: t, mouseCursorPosition: cursor, mouseButton: .left)! }
let moveE = mk(.mouseMoved), downE = mk(.leftMouseDown), dragE = mk(.leftMouseDragged), upE = mk(.leftMouseUp)
moveE.flags = []; downE.flags = []; upE.flags = []
log("posting move/down/drag")
moveE.post(tap: .cghidEventTap); downE.post(tap: .cghidEventTap); dragE.post(tap: .cghidEventTap)
func pressArrow(_ remaining: Int) {
    if remaining == 0 {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.40) {
            log("posting mouse up"); upE.post(tap: .cghidEventTap)
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                let after = CGSGetActiveSpace(CGSMainConnectionID())
                log("active space after: \(after) (was \(active))")
                let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []
                let onscreen = list.contains { ($0[kCGWindowOwnerPID as String] as? Int32) == app.processIdentifier && ($0[kCGWindowLayer as String] as? Int) == 0 }
                log("app has on-screen window on active space: \(onscreen)")
                exit(0)
            }
        }
        return
    }
    log("posting Ctrl+arrow (\(remaining) left)")
    if let kd = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true) { kd.flags = flags; kd.post(tap: .cghidEventTap) }
    usleep(40_000)
    if let ku = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false) { ku.flags = flags; ku.post(tap: .cghidEventTap) }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { pressArrow(remaining - 1) }
}
DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { pressArrow(steps) }
RunLoop.main.run()
