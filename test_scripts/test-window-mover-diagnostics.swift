// Diagnostic for the Move Window feature: checks every primitive WindowMover.moveToSpace
// depends on (symbolic hotkeys, Accessibility focus routes) without posting any event.
// Build: DEVELOPER_DIR=/Library/Developer/CommandLineTools swiftc -O -framework Cocoa \
//        -F /System/Library/PrivateFrameworks -o /tmp/wmdiag test_scripts/test-window-mover-diagnostics.swift
import Cocoa
import ApplicationServices

typealias CGSSymbolicHotKey = UInt32
@_silgen_name("CGSGetSymbolicHotKeyValue")
func CGSGetSymbolicHotKeyValue(_ hotKey: CGSSymbolicHotKey, _ unknown: UnsafeMutableRawPointer?, _ keyCode: UnsafeMutablePointer<CGKeyCode>, _ modifiers: UnsafeMutablePointer<CGEventFlags>) -> Int32
@_silgen_name("CGSIsSymbolicHotKeyEnabled")
func CGSIsSymbolicHotKeyEnabled(_ hotKey: CGSSymbolicHotKey) -> Bool
@_silgen_name("CGSSetSymbolicHotKeyEnabled")
func CGSSetSymbolicHotKeyEnabled(_ hotKey: CGSSymbolicHotKey, _ enabled: Bool) -> Int32

print("AXIsProcessTrusted:", AXIsProcessTrusted())
print("frontmost:", NSWorkspace.shared.frontmostApplication?.localizedName ?? "nil")

for i in 1...9 {
    let hk = CGSSymbolicHotKey(117 + i)
    var keyCode: CGKeyCode = 0
    var flags: CGEventFlags = []
    let err = CGSGetSymbolicHotKeyValue(hk, nil, &keyCode, &flags)
    print("hotkey \(hk) (Desktop \(i)): err=\(err) keyCode=\(keyCode) flags=0x\(String(flags.rawValue, radix: 16)) enabled=\(CGSIsSymbolicHotKeyEnabled(hk))")
}

let systemWide = AXUIElementCreateSystemWide()
var focusedApp: CFTypeRef?
let r1 = AXUIElementCopyAttributeValue(systemWide, kAXFocusedApplicationAttribute as CFString, &focusedApp)
print("AXFocusedApplication result:", r1.rawValue)
if r1 == .success {
    var pid: pid_t = 0
    AXUIElementGetPid(focusedApp as! AXUIElement, &pid)
    print("focused app pid:", pid, NSRunningApplication(processIdentifier: pid)?.localizedName ?? "?")
    var focusedWindow: CFTypeRef?
    let r2 = AXUIElementCopyAttributeValue(focusedApp as! AXUIElement, kAXFocusedWindowAttribute as CFString, &focusedWindow)
    print("AXFocusedWindow result:", r2.rawValue)
    if r2 == .success {
        let w = focusedWindow as! AXUIElement
        var title: CFTypeRef?
        AXUIElementCopyAttributeValue(w, kAXTitleAttribute as CFString, &title)
        var posRef: CFTypeRef?
        AXUIElementCopyAttributeValue(w, kAXPositionAttribute as CFString, &posRef)
        var pos = CGPoint.zero
        if let p = posRef { AXValueGetValue(p as! AXValue, .cgPoint, &pos) }
        var mb: CFTypeRef?
        let r3 = AXUIElementCopyAttributeValue(w, kAXMinimizeButtonAttribute as CFString, &mb)
        var bpos = CGPoint.zero
        if r3 == .success {
            var bp: CFTypeRef?
            AXUIElementCopyAttributeValue(mb as! AXUIElement, kAXPositionAttribute as CFString, &bp)
            if let p = bp { AXValueGetValue(p as! AXValue, .cgPoint, &bpos) }
        }
        print("window title:", title as? String ?? "?", "pos:", pos, "minimizeButton result:", r3.rawValue, "buttonPos:", bpos)
    }
}
