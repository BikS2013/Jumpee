import Cocoa
import Carbon.HIToolbox

// MARK: - Private CGS API Declarations

@_silgen_name("CGSMainConnectionID")
func CGSMainConnectionID() -> Int32

@_silgen_name("CGSGetActiveSpace")
func CGSGetActiveSpace(_ cid: Int32) -> Int

@_silgen_name("CGSCopyManagedDisplaySpaces")
func CGSCopyManagedDisplaySpaces(_ cid: Int32) -> CFArray

// Symbolic hotkey APIs (used to look up "Switch to Desktop N" key combos)
typealias CGSSymbolicHotKey = UInt32

@_silgen_name("CGSGetSymbolicHotKeyValue")
func CGSGetSymbolicHotKeyValue(_ hotKey: CGSSymbolicHotKey, _ unknown: UnsafeMutableRawPointer?, _ keyCode: UnsafeMutablePointer<CGKeyCode>, _ modifiers: UnsafeMutablePointer<CGEventFlags>) -> Int32

@_silgen_name("CGSIsSymbolicHotKeyEnabled")
func CGSIsSymbolicHotKeyEnabled(_ hotKey: CGSSymbolicHotKey) -> Bool

@_silgen_name("CGSSetSymbolicHotKeyEnabled")
func CGSSetSymbolicHotKeyEnabled(_ hotKey: CGSSymbolicHotKey, _ enabled: Bool) -> Int32

// Private Accessibility API for getting CGWindowID from AXUIElement
@_silgen_name("_AXUIElementGetWindow")
func _AXUIElementGetWindow(_ element: AXUIElement, _ windowID: UnsafeMutablePointer<CGWindowID>) -> AXError


// MARK: - Configuration

struct OverlayConfig: Codable {
    var enabled: Bool
    var opacity: Double
    var fontName: String
    var fontSize: Double
    var fontWeight: String  // "regular", "bold", "heavy", "light"
    var position: String
    var textColor: String
    var margin: Double

    static let defaultConfig = OverlayConfig(
        enabled: true,
        opacity: 0.15,
        fontName: "Helvetica Neue",
        fontSize: 72,
        fontWeight: "bold",
        position: "top-center",
        textColor: "#FF0000",
        margin: 40
    )
}

struct HotkeyConfig: Codable {
    var key: String
    var modifiers: [String]

    static let defaultConfig = HotkeyConfig(
        key: "j",
        modifiers: ["command"]
    )

    var keyCode: CGKeyCode? {
        let keyMap: [String: CGKeyCode] = [
            "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7,
            "c": 8, "v": 9, "b": 11, "q": 12, "w": 13, "e": 14, "r": 15,
            "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22,
            "5": 23, "9": 25, "7": 26, "8": 28, "0": 29, "o": 31, "u": 32,
            "i": 34, "p": 35, "l": 37, "j": 38, "k": 40, "n": 45, "m": 46,
            "space": 49, "return": 36, "tab": 48, "escape": 53,
        ]
        return keyMap[key.lowercased()]
    }

    var carbonModifiers: UInt32 {
        var mods: UInt32 = 0
        for mod in modifiers {
            switch mod.lowercased() {
            case "command", "cmd": mods |= UInt32(cmdKey)
            case "control", "ctrl": mods |= UInt32(controlKey)
            case "option", "alt": mods |= UInt32(optionKey)
            case "shift": mods |= UInt32(shiftKey)
            default: break
            }
        }
        return mods
    }

    var displayString: String {
        var parts: [String] = []
        for mod in modifiers {
            switch mod.lowercased() {
            case "command", "cmd": parts.append("\u{2318}")
            case "control", "ctrl": parts.append("\u{2303}")
            case "option", "alt": parts.append("\u{2325}")
            case "shift": parts.append("\u{21E7}")
            default: break
            }
        }
        parts.append(key.uppercased())
        return parts.joined()
    }
}

struct MoveWindowConfig: Codable {
    /// Whether the move-window feature is enabled.
    /// When false, the "Move Window To..." submenu is hidden.
    var enabled: Bool
}

struct JumpeeConfig: Codable {
    var spaces: [String: String]
    var showSpaceNumber: Bool
    var overlay: OverlayConfig
    var hotkey: HotkeyConfig
    var moveWindow: MoveWindowConfig?

    static let configDir = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent(".Jumpee")
    static let configFile = configDir.appendingPathComponent("config.json")

    static func load() -> JumpeeConfig {
        if let data = try? Data(contentsOf: configFile),
           let config = try? JSONDecoder().decode(JumpeeConfig.self, from: data) {
            return config
        }
        return JumpeeConfig(
            spaces: [:],
            showSpaceNumber: true,
            overlay: OverlayConfig.defaultConfig,
            hotkey: HotkeyConfig.defaultConfig
        )
    }

    func save() {
        try? FileManager.default.createDirectory(at: Self.configDir, withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let data = try? encoder.encode(self) {
            try? data.write(to: Self.configFile)
        }
    }
}

// MARK: - Color Parsing

extension NSColor {
    static func fromHex(_ hex: String) -> NSColor {
        var hexString = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if hexString.hasPrefix("#") { hexString.removeFirst() }

        var rgb: UInt64 = 0
        Scanner(string: hexString).scanHexInt64(&rgb)

        let r = CGFloat((rgb >> 16) & 0xFF) / 255.0
        let g = CGFloat((rgb >> 8) & 0xFF) / 255.0
        let b = CGFloat(rgb & 0xFF) / 255.0
        return NSColor(red: r, green: g, blue: b, alpha: 1.0)
    }
}

// MARK: - Font Weight Parsing

func fontWeight(from string: String) -> NSFont.Weight {
    switch string.lowercased() {
    case "ultralight": return .ultraLight
    case "thin": return .thin
    case "light": return .light
    case "regular": return .regular
    case "medium": return .medium
    case "semibold": return .semibold
    case "bold": return .bold
    case "heavy": return .heavy
    case "black": return .black
    default: return .bold
    }
}

// MARK: - Space Detection

struct SpaceInfo {
    let spaceID: Int
    let localPosition: Int    // 1-based position within this display
    let globalPosition: Int   // 1-based position across all displays
}

struct DisplayInfo {
    let displayID: String     // UUID from CGSCopyManagedDisplaySpaces
    let spaces: [SpaceInfo]
}

class SpaceDetector {
    let connectionID: Int32

    init() {
        connectionID = CGSMainConnectionID()
    }

    func getCurrentSpaceID() -> Int {
        return CGSGetActiveSpace(connectionID)
    }

    func getAllSpaceIDs() -> [Int] {
        let spacesInfo = CGSCopyManagedDisplaySpaces(connectionID) as! [[String: Any]]
        var spaceIDs: [Int] = []

        for display in spacesInfo {
            if let spaces = display["Spaces"] as? [[String: Any]] {
                for space in spaces {
                    if let spaceID = space["ManagedSpaceID"] as? Int,
                       let type = space["type"] as? Int, type == 0 {
                        spaceIDs.append(spaceID)
                    }
                }
            }
        }
        return spaceIDs
    }

    func getCurrentSpaceIndex() -> Int? {
        let currentID = getCurrentSpaceID()
        let allIDs = getAllSpaceIDs()
        if let index = allIDs.firstIndex(of: currentID) {
            return index + 1
        }
        return nil
    }

    func getSpaceCount() -> Int {
        return getAllSpaceIDs().count
    }

    func getOrderedSpaces() -> [(position: Int, spaceID: Int)] {
        return getAllSpaceIDs().enumerated().map { (index, id) in
            (position: index + 1, spaceID: id)
        }
    }

    func getSpacesByDisplay() -> [DisplayInfo] {
        let spacesInfo = CGSCopyManagedDisplaySpaces(connectionID) as! [[String: Any]]
        var displays: [DisplayInfo] = []
        var globalCounter = 0

        for display in spacesInfo {
            let displayID = display["Display Identifier"] as? String ?? "Unknown"
            var spaces: [SpaceInfo] = []
            var localCounter = 0

            if let spaceList = display["Spaces"] as? [[String: Any]] {
                for space in spaceList {
                    if let spaceID = space["ManagedSpaceID"] as? Int,
                       let type = space["type"] as? Int, type == 0 {
                        localCounter += 1
                        globalCounter += 1
                        spaces.append(SpaceInfo(
                            spaceID: spaceID,
                            localPosition: localCounter,
                            globalPosition: globalCounter
                        ))
                    }
                }
            }

            if !spaces.isEmpty {
                displays.append(DisplayInfo(displayID: displayID, spaces: spaces))
            }
        }
        return displays
    }

    func getActiveDisplayID() -> String? {
        let currentID = getCurrentSpaceID()
        let displays = getSpacesByDisplay()
        for display in displays {
            if display.spaces.contains(where: { $0.spaceID == currentID }) {
                return display.displayID
            }
        }
        return displays.first?.displayID
    }

    func getCurrentSpaceInfo() -> (displayID: String, localPosition: Int, globalPosition: Int, spaceID: Int)? {
        let currentID = getCurrentSpaceID()
        let displays = getSpacesByDisplay()
        for display in displays {
            if let space = display.spaces.first(where: { $0.spaceID == currentID }) {
                return (displayID: display.displayID, localPosition: space.localPosition,
                        globalPosition: space.globalPosition, spaceID: space.spaceID)
            }
        }
        return nil
    }

    func displayIDToScreen(_ displayID: String) -> NSScreen? {
        for screen in NSScreen.screens {
            guard let screenNumber = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID else {
                continue
            }
            if displayID == "Main" {
                if screenNumber == CGMainDisplayID() {
                    return screen
                }
            } else {
                if let uuid = CGDisplayCreateUUIDFromDisplayID(screenNumber) {
                    let uuidString = CFUUIDCreateString(nil, uuid.takeUnretainedValue()) as String?
                    if let uuidStr = uuidString, uuidStr.caseInsensitiveCompare(displayID) == .orderedSame {
                        return screen
                    }
                }
            }
        }
        return NSScreen.main
    }
}

// MARK: - Overlay Window

class OverlayWindow: NSWindow {
    private let label: NSTextField

    init(screen: NSScreen, text: String, config: OverlayConfig) {
        label = NSTextField(labelWithString: text)

        let screenFrame = screen.frame
        super.init(
            contentRect: screenFrame,
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )

        self.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)) + 1)
        self.backgroundColor = .clear
        self.isOpaque = false
        self.hasShadow = false
        self.ignoresMouseEvents = true
        self.collectionBehavior = [.canJoinAllSpaces, .stationary]

        let contentView = NSView(frame: screenFrame)
        contentView.wantsLayer = true
        self.contentView = contentView

        let weight = fontWeight(from: config.fontWeight)
        let font = NSFont(name: config.fontName, size: CGFloat(config.fontSize))
            ?? NSFont.systemFont(ofSize: CGFloat(config.fontSize), weight: weight)
        let color = NSColor.fromHex(config.textColor).withAlphaComponent(CGFloat(config.opacity))

        label.font = font
        label.textColor = color
        label.backgroundColor = .clear
        label.isBezeled = false
        label.isEditable = false
        label.isSelectable = false
        label.alignment = .center
        label.sizeToFit()

        contentView.addSubview(label)
        positionLabel(in: contentView, config: config)
    }

    func updateText(_ text: String, config: OverlayConfig) {
        let weight = fontWeight(from: config.fontWeight)
        let font = NSFont(name: config.fontName, size: CGFloat(config.fontSize))
            ?? NSFont.systemFont(ofSize: CGFloat(config.fontSize), weight: weight)
        let color = NSColor.fromHex(config.textColor).withAlphaComponent(CGFloat(config.opacity))

        label.stringValue = text
        label.font = font
        label.textColor = color
        label.sizeToFit()

        if let contentView = self.contentView {
            positionLabel(in: contentView, config: config)
        }
    }

    private func positionLabel(in containerView: NSView, config: OverlayConfig) {
        let margin = CGFloat(config.margin)
        let containerSize = containerView.bounds.size
        let labelSize = label.fittingSize

        var x: CGFloat
        var y: CGFloat

        switch config.position {
        case "top-left":
            x = margin
            y = containerSize.height - labelSize.height - margin
        case "top-right":
            x = containerSize.width - labelSize.width - margin
            y = containerSize.height - labelSize.height - margin
        case "top-center":
            x = (containerSize.width - labelSize.width) / 2
            y = containerSize.height - labelSize.height - margin
        case "bottom-left":
            x = margin
            y = margin
        case "bottom-right":
            x = containerSize.width - labelSize.width - margin
            y = margin
        case "bottom-center":
            x = (containerSize.width - labelSize.width) / 2
            y = margin
        case "center":
            x = (containerSize.width - labelSize.width) / 2
            y = (containerSize.height - labelSize.height) / 2
        default:
            x = (containerSize.width - labelSize.width) / 2
            y = containerSize.height - labelSize.height - margin
        }

        label.frame = NSRect(x: x, y: y, width: labelSize.width, height: labelSize.height)
    }
}

// MARK: - Overlay Manager

class OverlayManager {
    private var overlayWindow: OverlayWindow?
    private let spaceDetector: SpaceDetector

    init(spaceDetector: SpaceDetector) {
        self.spaceDetector = spaceDetector
    }

    func updateOverlay(config: JumpeeConfig) {
        guard config.overlay.enabled else {
            removeAllOverlays()
            return
        }

        guard let spaceInfo = spaceDetector.getCurrentSpaceInfo() else { return }
        let screen = spaceDetector.displayIDToScreen(spaceInfo.displayID) ?? NSScreen.main
        guard let targetScreen = screen else { return }

        let key = String(spaceInfo.spaceID)
        let customName = config.spaces[key]

        let displayText: String
        if let name = customName, !name.isEmpty {
            if config.showSpaceNumber {
                displayText = "\(spaceInfo.localPosition): \(name)"
            } else {
                displayText = name
            }
        } else {
            displayText = "Desktop \(spaceInfo.localPosition)"
        }

        if let existing = overlayWindow {
            existing.setFrame(targetScreen.frame, display: true)
            existing.updateText(displayText, config: config.overlay)
        } else {
            let window = OverlayWindow(screen: targetScreen, text: displayText, config: config.overlay)
            window.orderFront(nil)
            overlayWindow = window
        }
    }

    func removeAllOverlays() {
        overlayWindow?.orderOut(nil)
        overlayWindow = nil
    }
}

// MARK: - Space Navigation

class SpaceNavigator {
    static func navigateToSpace(index: Int) {
        let keyCode = keyCodeForNumber(index)
        let source = CGEventSource(stateID: .hidSystemState)

        if let keyDown = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: true) {
            keyDown.flags = .maskControl
            keyDown.post(tap: .cghidEventTap)
        }
        if let keyUp = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: false) {
            keyUp.flags = .maskControl
            keyUp.post(tap: .cghidEventTap)
        }
    }

    static func checkAccessibility() {
        let trusted = AXIsProcessTrusted()
        if !trusted {
            let options = [kAXTrustedCheckOptionPrompt.takeRetainedValue(): true] as CFDictionary
            AXIsProcessTrustedWithOptions(options)
        }
    }

    static func keyCodeForNumber(_ n: Int) -> Int {
        switch n {
        case 1: return 18
        case 2: return 19
        case 3: return 20
        case 4: return 21
        case 5: return 23
        case 6: return 22
        case 7: return 26
        case 8: return 28
        case 9: return 25
        default: return 18
        }
    }
}

// MARK: - Window Mover

class WindowMover {

    /// Move the focused window to the given desktop using mouse-drag simulation.
    ///
    /// This replicates the Amethyst 0.22.0+ approach for macOS 15 (Sequoia):
    /// 1. Find the focused window's title bar position via Accessibility API
    /// 2. Simulate mouse-down + drag on the title bar
    /// 3. Fire the "Switch to Desktop N" system hotkey while dragging
    /// 4. Release the mouse — the window lands on the new space
    ///
    /// Requires "Switch to Desktop N" shortcuts to be enabled in System Settings
    /// (the same shortcuts Jumpee already uses for space navigation).
    ///
    /// - Parameter index: 1-based global desktop position (1 through 16).
    static func moveToSpace(index: Int) {
        guard index >= 1 && index <= 16 else { return }

        // 1. Get the "Switch to Desktop N" hotkey from the OS
        //    Symbolic hotkey IDs: Desktop 1 = 119, Desktop 2 = 120, ..., Desktop N = 118 + N
        let symbolicHotKey: CGSSymbolicHotKey = UInt32(118 + index)
        var keyCode: CGKeyCode = 0
        var modifierFlags: CGEventFlags = []

        let error = CGSGetSymbolicHotKeyValue(symbolicHotKey, nil, &keyCode, &modifierFlags)
        guard error == 0 else { return }

        // Temporarily enable the hotkey if it's disabled
        let wasEnabled = CGSIsSymbolicHotKeyEnabled(symbolicHotKey)
        if !wasEnabled {
            _ = CGSSetSymbolicHotKeyEnabled(symbolicHotKey, true)
        }

        // 2. Get the focused window via Accessibility API
        let systemWide = AXUIElementCreateSystemWide()
        var focusedApp: CFTypeRef?
        guard AXUIElementCopyAttributeValue(systemWide, kAXFocusedApplicationAttribute as CFString, &focusedApp) == .success else {
            if !wasEnabled { _ = CGSSetSymbolicHotKeyEnabled(symbolicHotKey, false) }
            return
        }

        var focusedWindow: CFTypeRef?
        guard AXUIElementCopyAttributeValue(focusedApp as! AXUIElement, kAXFocusedWindowAttribute as CFString, &focusedWindow) == .success else {
            if !wasEnabled { _ = CGSSetSymbolicHotKeyEnabled(symbolicHotKey, false) }
            return
        }

        let window = focusedWindow as! AXUIElement

        // 3. Find cursor position in the title bar
        var cursorPosition: CGPoint
        var minimizeButton: CFTypeRef?
        if AXUIElementCopyAttributeValue(window, kAXMinimizeButtonAttribute as CFString, &minimizeButton) == .success {
            var posRef: CFTypeRef?
            AXUIElementCopyAttributeValue(minimizeButton as! AXUIElement, kAXPositionAttribute as CFString, &posRef)
            var buttonPos = CGPoint.zero
            if let posVal = posRef {
                AXValueGetValue(posVal as! AXValue, .cgPoint, &buttonPos)
            }
            var winPosRef: CFTypeRef?
            AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &winPosRef)
            var winPos = CGPoint.zero
            if let wVal = winPosRef {
                AXValueGetValue(wVal as! AXValue, .cgPoint, &winPos)
            }
            cursorPosition = CGPoint(
                x: buttonPos.x,
                y: winPos.y + abs(winPos.y - buttonPos.y) / 2.0
            )
        } else {
            // Fallback: near top-left of window
            var winPosRef: CFTypeRef?
            AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &winPosRef)
            var winPos = CGPoint.zero
            if let wVal = winPosRef {
                AXValueGetValue(wVal as! AXValue, .cgPoint, &winPos)
            }
            cursorPosition = CGPoint(x: winPos.x + 40, y: winPos.y + 12)
        }

        // 4. Build mouse events for the drag simulation
        guard let moveEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved,
                                       mouseCursorPosition: cursorPosition, mouseButton: .left),
              let downEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown,
                                       mouseCursorPosition: cursorPosition, mouseButton: .left),
              let dragEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged,
                                       mouseCursorPosition: cursorPosition, mouseButton: .left),
              let upEvent   = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp,
                                       mouseCursorPosition: cursorPosition, mouseButton: .left) else {
            if !wasEnabled { _ = CGSSetSymbolicHotKeyEnabled(symbolicHotKey, false) }
            return
        }
        moveEvent.flags = []
        downEvent.flags = []
        upEvent.flags = []

        // 5. Grab the window's title bar
        moveEvent.post(tap: .cghidEventTap)
        downEvent.post(tap: .cghidEventTap)
        dragEvent.post(tap: .cghidEventTap)

        // 6. After 50ms: fire the space-switch hotkey while window is grabbed
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            if let keyDown = CGEvent(keyboardEventSource: nil,
                                     virtualKey: keyCode, keyDown: true) {
                keyDown.flags = modifierFlags
                keyDown.post(tap: .cghidEventTap)
            }
            if let keyUp = CGEvent(keyboardEventSource: nil,
                                    virtualKey: keyCode, keyDown: false) {
                keyUp.flags = []
                keyUp.post(tap: .cghidEventTap)
            }

            // 7. After 400ms: release mouse — window lands on new space
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.40) {
                upEvent.post(tap: .cghidEventTap)
                if !wasEnabled {
                    _ = CGSSetSymbolicHotKeyEnabled(symbolicHotKey, false)
                }
            }
        }
    }

    /// Check whether "Switch to Desktop 1" shortcut is enabled.
    /// This is the same shortcut Jumpee already requires for navigation.
    static func areSystemShortcutsEnabled() -> Bool {
        return CGSIsSymbolicHotKeyEnabled(119)
    }
}

// MARK: - Global Hotkey Manager (Carbon API)

private var globalMenuBarController: MenuBarController?

func hotkeyEventHandler(nextHandler: EventHandlerCallRef?, event: EventRef?, userData: UnsafeMutableRawPointer?) -> OSStatus {
    DispatchQueue.main.async {
        globalMenuBarController?.openMenu()
    }
    return noErr
}

class GlobalHotkeyManager {
    private var hotkeyRef: EventHotKeyRef?
    private var handlerRef: EventHandlerRef?
    private let hotkeyID = EventHotKeyID(signature: OSType(0x4A4D_5045), id: 1) // "JMPE"

    func register(config: HotkeyConfig) {
        unregister()

        guard let keyCode = config.keyCode else { return }
        let carbonModifiers = config.carbonModifiers

        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))

        InstallEventHandler(
            GetApplicationEventTarget(),
            hotkeyEventHandler,
            1,
            &eventType,
            nil,
            &handlerRef
        )

        let hotKeyID = hotkeyID
        RegisterEventHotKey(
            UInt32(keyCode),
            carbonModifiers,
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotkeyRef
        )
    }

    func unregister() {
        if let ref = hotkeyRef {
            UnregisterEventHotKey(ref)
            hotkeyRef = nil
        }
        if let ref = handlerRef {
            RemoveEventHandler(ref)
            handlerRef = nil
        }
    }

    deinit {
        unregister()
    }
}

// MARK: - Menu Bar Controller

class MenuBarController: NSObject {
    let statusItem: NSStatusItem
    private let spaceDetector: SpaceDetector
    private var config: JumpeeConfig
    private var spaceMenuItems: [NSMenuItem] = []
    private let overlayManager: OverlayManager
    private var hotkeyManager: GlobalHotkeyManager?

    override init() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        spaceDetector = SpaceDetector()
        config = JumpeeConfig.load()
        overlayManager = OverlayManager(spaceDetector: spaceDetector)
        super.init()
        migratePositionBasedConfig()
        setupMenu()
        updateTitle()
        registerForSpaceChanges()

        globalMenuBarController = self
        hotkeyManager = GlobalHotkeyManager()
        hotkeyManager?.register(config: config.hotkey)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.overlayManager.updateOverlay(config: self!.config)
        }
    }

    func openMenu() {
        statusItem.button?.performClick(nil)
    }

    private func migratePositionBasedConfig() {
        guard !config.spaces.isEmpty else { return }

        let allSpaceIDs = spaceDetector.getAllSpaceIDs()
        let spaceCount = allSpaceIDs.count
        guard spaceCount > 0 else { return }

        // Check if all keys are position-based (integers in 1...spaceCount)
        let allPositionBased = config.spaces.keys.allSatisfy { key in
            guard let pos = Int(key) else { return false }
            return pos >= 1 && pos <= spaceCount
        }

        guard allPositionBased else { return }

        // Migrate
        var migratedSpaces: [String: String] = [:]
        for (positionKey, name) in config.spaces {
            let positionIndex = Int(positionKey)! - 1
            if positionIndex < allSpaceIDs.count {
                let newKey = String(allSpaceIDs[positionIndex])
                migratedSpaces[newKey] = name
            }
        }

        config.spaces = migratedSpaces
        config.save()
        print("[Jumpee] Migrated \(migratedSpaces.count) space name(s) from position-based to space-ID-based keys.")
    }

    private func setupMenu() {
        let menu = NSMenu()

        let headerItem = NSMenuItem(title: "Jumpee", action: nil, keyEquivalent: "")
        headerItem.isEnabled = false
        let headerFont = NSFont.boldSystemFont(ofSize: 13)
        headerItem.attributedTitle = NSAttributedString(string: "Jumpee", attributes: [.font: headerFont])
        menu.addItem(headerItem)
        menu.addItem(NSMenuItem.separator())

        let spacesHeaderItem = NSMenuItem(title: "Desktops:", action: nil, keyEquivalent: "")
        spacesHeaderItem.isEnabled = false
        menu.addItem(spacesHeaderItem)

        menu.addItem(NSMenuItem.separator())

        let toggleItem = NSMenuItem(
            title: config.showSpaceNumber ? "Hide Space Number" : "Show Space Number",
            action: #selector(toggleSpaceNumber),
            keyEquivalent: "")
        toggleItem.target = self
        toggleItem.tag = 100
        menu.addItem(toggleItem)

        let overlayItem = NSMenuItem(
            title: config.overlay.enabled ? "Disable Overlay" : "Enable Overlay",
            action: #selector(toggleOverlay),
            keyEquivalent: "")
        overlayItem.target = self
        overlayItem.tag = 101
        menu.addItem(overlayItem)

        menu.addItem(NSMenuItem.separator())

        let configItem = NSMenuItem(title: "Open Config File...", action: #selector(openConfig), keyEquivalent: ",")
        configItem.target = self
        menu.addItem(configItem)

        let reloadItem = NSMenuItem(title: "Reload Config", action: #selector(reloadConfig), keyEquivalent: "r")
        reloadItem.target = self
        menu.addItem(reloadItem)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "Quit Jumpee", action: #selector(quit), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        menu.delegate = self
        statusItem.menu = menu
    }

    func updateTitle() {
        guard let spaceInfo = spaceDetector.getCurrentSpaceInfo() else {
            statusItem.button?.title = "?"
            return
        }

        let key = String(spaceInfo.spaceID)
        if let customName = config.spaces[key], !customName.isEmpty {
            if config.showSpaceNumber {
                statusItem.button?.title = "\(spaceInfo.localPosition): \(customName)"
            } else {
                statusItem.button?.title = customName
            }
        } else {
            statusItem.button?.title = "Desktop \(spaceInfo.localPosition)"
        }
    }

    private func rebuildSpaceItems() {
        guard let menu = statusItem.menu else { return }

        for item in spaceMenuItems {
            menu.removeItem(item)
        }
        spaceMenuItems.removeAll()

        var insertIndex = 0
        for (i, item) in menu.items.enumerated() {
            if item.title == "Desktops:" {
                insertIndex = i + 1
                break
            }
        }

        let displays = spaceDetector.getSpacesByDisplay()
        let currentSpaceID = spaceDetector.getCurrentSpaceID()
        let activeDisplayID = spaceDetector.getActiveDisplayID()

        for display in displays {
            let isActiveDisplay = display.displayID == activeDisplayID

            // Display header
            let screenCount = displays.count
            let displayLabel: String
            if screenCount > 1 {
                if let screen = spaceDetector.displayIDToScreen(display.displayID) {
                    displayLabel = isActiveDisplay ? "Display: \(screen.localizedName) (active)" : "Display: \(screen.localizedName)"
                } else {
                    displayLabel = isActiveDisplay ? "Display (active)" : "Display"
                }
            } else {
                displayLabel = "Desktops"
            }

            if screenCount > 1 {
                let headerItem = NSMenuItem(title: displayLabel, action: nil, keyEquivalent: "")
                headerItem.isEnabled = false
                let headerFont = NSFont.boldSystemFont(ofSize: 11)
                headerItem.attributedTitle = NSAttributedString(string: displayLabel, attributes: [.font: headerFont])
                menu.insertItem(headerItem, at: insertIndex)
                spaceMenuItems.append(headerItem)
                insertIndex += 1
            }

            for space in display.spaces {
                let key = String(space.spaceID)
                let customName = config.spaces[key]

                let displayName: String
                if let name = customName, !name.isEmpty {
                    displayName = "Desktop \(space.localPosition) - \(name)"
                } else {
                    displayName = "Desktop \(space.localPosition)"
                }

                // Cmd+1-9 shortcuts only for the active display
                let keyEquiv = (isActiveDisplay && space.localPosition <= 9) ? String(space.localPosition) : ""
                let item = NSMenuItem(title: displayName, action: #selector(navigateToSpace(_:)), keyEquivalent: keyEquiv)
                item.keyEquivalentModifierMask = .command
                item.target = self
                item.tag = space.globalPosition  // global position for navigation

                if currentSpaceID == space.spaceID {
                    item.state = .on
                }

                if !isActiveDisplay {
                    item.indentationLevel = 1
                }

                menu.insertItem(item, at: insertIndex)
                spaceMenuItems.append(item)
                insertIndex += 1
            }

            // Separator between displays
            if displays.count > 1 && display.displayID != displays.last?.displayID {
                let sep = NSMenuItem.separator()
                menu.insertItem(sep, at: insertIndex)
                spaceMenuItems.append(sep)
                insertIndex += 1
            }
        }

        let renameItem = NSMenuItem(title: "Rename Current Desktop...", action: #selector(renameActiveSpace), keyEquivalent: "n")
        renameItem.target = self
        renameItem.tag = 200
        menu.insertItem(renameItem, at: insertIndex)
        spaceMenuItems.append(renameItem)

        // --- Move Window submenu (after the Rename item) ---

        // Only show if moveWindow feature is enabled in config
        if config.moveWindow?.enabled == true {
            insertIndex += 1  // skip past Rename item

            let moveSubmenuItem = NSMenuItem(title: "Move Window To...", action: nil,
                                              keyEquivalent: "")
            let moveSubmenu = NSMenu()

            // Add a destination item for each desktop on the active display,
            // excluding the current desktop
            for display in displays {
                let isActiveDisplay = display.displayID == activeDisplayID
                guard isActiveDisplay else { continue }

                for space in display.spaces {
                    if space.spaceID == currentSpaceID { continue }  // skip current

                    let key = String(space.spaceID)
                    let customName = config.spaces[key]
                    let displayName: String
                    if let name = customName, !name.isEmpty {
                        displayName = "Desktop \(space.localPosition) - \(name)"
                    } else {
                        displayName = "Desktop \(space.localPosition)"
                    }

                    // Shift+Cmd+N as keyboard equivalent (active only when menu is open)
                    let keyEquiv = space.localPosition <= 9
                        ? String(space.localPosition) : ""
                    let moveItem = NSMenuItem(title: displayName,
                                               action: #selector(moveWindowToSpace(_:)),
                                               keyEquivalent: keyEquiv)
                    moveItem.keyEquivalentModifierMask = [.command, .shift]
                    moveItem.target = self
                    moveItem.tag = space.globalPosition
                    moveSubmenu.addItem(moveItem)
                }
            }

            moveSubmenuItem.submenu = moveSubmenu
            menu.insertItem(moveSubmenuItem, at: insertIndex)
            spaceMenuItems.append(moveSubmenuItem)
        }

        // "Set Up Window Moving..." item -- always shown when feature is enabled
        // or when it hasn't been configured yet
        if config.moveWindow?.enabled == true || config.moveWindow == nil {
            insertIndex += 1
            let setupItem = NSMenuItem(title: "Set Up Window Moving...",
                                        action: #selector(showMoveWindowSetup),
                                        keyEquivalent: "")
            setupItem.target = self
            // Only show if shortcuts are NOT enabled (acts as guidance trigger)
            if config.moveWindow?.enabled == true
                && WindowMover.areSystemShortcutsEnabled() {
                // Shortcuts already enabled -- hide the setup item
            } else {
                menu.insertItem(setupItem, at: insertIndex)
                spaceMenuItems.append(setupItem)
            }
        }

        if let toggleItem = menu.item(withTag: 100) {
            toggleItem.title = config.showSpaceNumber ? "Hide Space Number" : "Show Space Number"
        }
        if let overlayItem = menu.item(withTag: 101) {
            overlayItem.title = config.overlay.enabled ? "Disable Overlay" : "Enable Overlay"
        }
    }

    private func registerForSpaceChanges() {
        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(spaceDidChange),
            name: NSWorkspace.activeSpaceDidChangeNotification,
            object: nil)

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenParametersDidChange),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil)
    }

    @objc private func spaceDidChange(_ notification: Notification) {
        updateTitle()
        overlayManager.updateOverlay(config: config)
    }

    @objc private func screenParametersDidChange(_ notification: Notification) {
        updateTitle()
        overlayManager.updateOverlay(config: config)
    }

    @objc private func navigateToSpace(_ sender: NSMenuItem) {
        let globalPosition = sender.tag
        guard let currentInfo = spaceDetector.getCurrentSpaceInfo() else { return }
        if globalPosition != currentInfo.globalPosition {
            statusItem.menu?.cancelTracking()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                SpaceNavigator.navigateToSpace(index: globalPosition)
            }
        }
    }

    /// Handle "Move Window To > Desktop N" submenu selection.
    /// Closes the menu, waits for the previously-focused app to regain focus,
    /// then synthesizes the Ctrl+Shift+N system shortcut.
    @objc private func moveWindowToSpace(_ sender: NSMenuItem) {
        let targetGlobalPosition = sender.tag
        statusItem.menu?.cancelTracking()

        // Wait 300ms for Jumpee's menu to close and the target app to regain focus.
        // This is the same delay used by navigateToSpace(_:) and is proven reliable.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            WindowMover.moveToSpace(index: targetGlobalPosition)
        }
    }

    /// Show a setup dialog guiding the user to enable "Move window to Desktop N"
    /// shortcuts in System Settings.
    @objc private func showMoveWindowSetup() {
        let alert = NSAlert()
        alert.messageText = "Set Up Window Moving"

        if WindowMover.areSystemShortcutsEnabled() {
            alert.informativeText = """
                The "Switch to Desktop N" shortcuts are enabled. \
                You can move windows using the Jumpee menu \
                (Move Window To... submenu).

                To enable, add this to your ~/.Jumpee/config.json:
                "moveWindow": { "enabled": true }
                """
            alert.addButton(withTitle: "OK")
            NSApp.activate(ignoringOtherApps: true)
            alert.runModal()
            return
        }

        alert.informativeText = """
            To move windows between desktops, enable the \
            "Switch to Desktop N" keyboard shortcuts in macOS:

            1. Open System Settings > Keyboard > Keyboard Shortcuts
            2. Select "Mission Control" in the left panel
            3. Enable checkboxes for "Switch to Desktop 1" \
            through "Switch to Desktop 9"

            These are the same shortcuts Jumpee uses for navigation. \
            If desktop switching already works, just add this to \
            your ~/.Jumpee/config.json:
            "moveWindow": { "enabled": true }
            """
        alert.addButton(withTitle: "Open System Settings")
        alert.addButton(withTitle: "Cancel")

        NSApp.activate(ignoringOtherApps: true)
        let response = alert.runModal()

        if response == .alertFirstButtonReturn {
            if let url = URL(string:
                "x-apple.systempreferences:com.apple.preference.keyboard?Shortcuts") {
                NSWorkspace.shared.open(url)
            }
        }
    }

    @objc private func renameActiveSpace() {
        guard let spaceInfo = spaceDetector.getCurrentSpaceInfo() else { return }
        let key = String(spaceInfo.spaceID)
        let currentName = config.spaces[key] ?? ""

        let alert = NSAlert()
        alert.messageText = "Rename Desktop \(spaceInfo.localPosition)"
        alert.informativeText = "Enter a custom name for this desktop:"
        alert.addButton(withTitle: "Save")
        alert.addButton(withTitle: "Clear Name")
        alert.addButton(withTitle: "Cancel")

        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 300, height: 24))
        input.stringValue = currentName
        input.placeholderString = "e.g., Development, Email, Browser..."
        alert.accessoryView = input
        alert.window.initialFirstResponder = input

        // Force focus on the text field
        NSApp.activate(ignoringOtherApps: true)
        alert.window.makeKeyAndOrderFront(nil)
        alert.window.makeFirstResponder(input)

        let response = alert.runModal()

        if response == .alertFirstButtonReturn {
            let newName = input.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
            if !newName.isEmpty {
                config.spaces[key] = newName
            } else {
                config.spaces.removeValue(forKey: key)
            }
            config.save()
            updateTitle()
            overlayManager.updateOverlay(config: config)
        } else if response == .alertSecondButtonReturn {
            config.spaces.removeValue(forKey: key)
            config.save()
            updateTitle()
            overlayManager.updateOverlay(config: config)
        }
    }

    @objc private func toggleSpaceNumber() {
        config.showSpaceNumber.toggle()
        config.save()
        updateTitle()
        overlayManager.updateOverlay(config: config)
    }

    @objc private func toggleOverlay() {
        config.overlay.enabled.toggle()
        config.save()
        overlayManager.updateOverlay(config: config)
    }

    @objc private func openConfig(_ sender: NSMenuItem) {
        if !FileManager.default.fileExists(atPath: JumpeeConfig.configFile.path) {
            config.save()
        }
        NSWorkspace.shared.open(JumpeeConfig.configFile)
    }

    @objc private func reloadConfig(_ sender: NSMenuItem) {
        config = JumpeeConfig.load()
        updateTitle()
        overlayManager.updateOverlay(config: config)
        hotkeyManager?.register(config: config.hotkey)
    }

    @objc private func quit(_ sender: NSMenuItem) {
        hotkeyManager?.unregister()
        overlayManager.removeAllOverlays()
        NSApp.terminate(nil)
    }
}

// MARK: - NSMenuDelegate

extension MenuBarController: NSMenuDelegate {
    func menuWillOpen(_ menu: NSMenu) {
        rebuildSpaceItems()
    }
}

// MARK: - App Delegate

class AppDelegate: NSObject, NSApplicationDelegate {
    var menuBarController: MenuBarController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        SpaceNavigator.checkAccessibility()
        menuBarController = MenuBarController()
    }
}

// MARK: - Main

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
