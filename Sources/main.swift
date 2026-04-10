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

// Private CGS APIs for window level manipulation (pin window on top)
@_silgen_name("CGSSetWindowLevel")
func CGSSetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: Int32) -> CGError

@_silgen_name("CGSGetWindowLevel")
func CGSGetWindowLevel(_ connection: Int32, _ windowID: CGWindowID, _ level: UnsafeMutablePointer<Int32>) -> CGError

// CGWindowListCreateImage — marked obsoleted in macOS 15 SDK headers but the symbol
// still exists at runtime. We call it via @_silgen_name to bypass the SDK availability
// check, the same approach Jumpee uses for all other private/restricted APIs.
@_silgen_name("CGWindowListCreateImage")
func JumpeeCGWindowListCreateImage(_ screenBounds: CGRect, _ listOption: UInt32, _ windowID: CGWindowID, _ imageOption: UInt32) -> CGImage?


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

struct PinWindowConfig: Codable {
    /// Whether the pin-window-on-top feature is enabled.
    /// When false, the pin menu items and hotkey are hidden/inactive.
    var enabled: Bool
}

struct InputSourceIndicatorConfig: Codable {
    // --- Required field ---
    var enabled: Bool

    // --- Optional appearance fields (nil = use documented default) ---
    var fontSize: Double?
    var fontName: String?
    var fontWeight: String?          // "regular", "bold", "heavy", "light", "medium", etc.
    var textColor: String?           // Hex color string, e.g. "#FFFFFF"
    var opacity: Double?             // 0.0 - 1.0 for text opacity
    var backgroundColor: String?     // Hex color string for background pill
    var backgroundOpacity: Double?   // 0.0 - 1.0 for background opacity
    var backgroundCornerRadius: Double?  // Corner radius in points
    var verticalOffset: Double?      // Additional pixels below menu bar
    var languageColors: [String: String]?  // Map of input source name to hex color, e.g. {"Greek": "#0066FF"}
    var languageLabels: [String: String]?  // Map of input source name to display text, e.g. {"Greek": "ΕΛ", "U.S.": "EN"}

    // --- Documented default constants ---
    // (Exception to no-default-fallback rule: see Issues - Pending Items.md, item 16.
    //  Follows precedent of moveWindowHotkey item 11 and pinWindowHotkey item 12.)
    static let defaultFontSize: Double = 60
    static let defaultFontName: String = "Helvetica Neue"
    static let defaultFontWeight: String = "bold"
    static let defaultTextColor: String = "#FFFFFF"
    static let defaultOpacity: Double = 0.8
    static let defaultBackgroundColor: String = "#000000"
    static let defaultBackgroundOpacity: Double = 0.3
    static let defaultBackgroundCornerRadius: Double = 10
    static let defaultVerticalOffset: Double = 0

    // --- Resolved computed properties ---
    var effectiveFontSize: Double { fontSize ?? Self.defaultFontSize }
    var effectiveFontName: String { fontName ?? Self.defaultFontName }
    var effectiveFontWeight: String { fontWeight ?? Self.defaultFontWeight }
    var effectiveTextColor: String { textColor ?? Self.defaultTextColor }
    var effectiveOpacity: Double { opacity ?? Self.defaultOpacity }
    var effectiveBackgroundColor: String { backgroundColor ?? Self.defaultBackgroundColor }
    var effectiveBackgroundOpacity: Double { backgroundOpacity ?? Self.defaultBackgroundOpacity }
    var effectiveBackgroundCornerRadius: Double { backgroundCornerRadius ?? Self.defaultBackgroundCornerRadius }
    var effectiveVerticalOffset: Double { verticalOffset ?? Self.defaultVerticalOffset }

    /// Returns the display text for a given input source name.
    /// Checks languageLabels map first, falls back to the raw input source name.
    func effectiveDisplayText(for inputSourceName: String) -> String {
        if let labels = languageLabels, let label = labels[inputSourceName] {
            return label
        }
        return inputSourceName
    }

    /// Returns the text color for a given input source name.
    /// Checks languageColors map first, falls back to the general textColor setting.
    func effectiveTextColor(for inputSourceName: String) -> String {
        if let langColors = languageColors, let color = langColors[inputSourceName] {
            return color
        }
        return effectiveTextColor
    }
}

struct JumpeeConfig: Codable {
    var spaces: [String: String]
    var showSpaceNumber: Bool
    var overlay: OverlayConfig
    var hotkey: HotkeyConfig
    var moveWindow: MoveWindowConfig?
    var moveWindowHotkey: HotkeyConfig?
    var pinWindow: PinWindowConfig?
    var pinWindowHotkey: HotkeyConfig?
    var inputSourceIndicator: InputSourceIndicatorConfig?

    /// Resolved move-window hotkey: explicit config or default Cmd+M.
    /// Documented exception to the no-default-fallback rule (see Issues - Pending Items.md).
    var effectiveMoveWindowHotkey: HotkeyConfig {
        return moveWindowHotkey ?? HotkeyConfig(key: "m", modifiers: ["command"])
    }

    /// Resolved pin-window hotkey: explicit config or default Ctrl+Cmd+P.
    /// Documented exception to the no-default-fallback rule (see Issues - Pending Items.md).
    var effectivePinWindowHotkey: HotkeyConfig {
        return pinWindowHotkey ?? HotkeyConfig(key: "p", modifiers: ["control", "command"])
    }

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

// MARK: - Input Source Indicator Window

class InputSourceIndicatorWindow: NSWindow {
    private let label: NSTextField
    private let backgroundView: NSView
    private let horizontalPadding: CGFloat = 20
    private let verticalPadding: CGFloat = 8

    init(screen: NSScreen, text: String, config: InputSourceIndicatorConfig, statusItemFrame: NSRect? = nil) {
        let displayText = config.effectiveDisplayText(for: text)
        label = NSTextField(labelWithString: displayText)
        backgroundView = NSView()
        backgroundView.wantsLayer = true

        // Apply font styling
        let weight = fontWeight(from: config.effectiveFontWeight)
        let font = NSFont(name: config.effectiveFontName, size: CGFloat(config.effectiveFontSize))
            ?? NSFont.systemFont(ofSize: CGFloat(config.effectiveFontSize), weight: weight)
        let color = NSColor.fromHex(config.effectiveTextColor(for: text))
            .withAlphaComponent(CGFloat(config.effectiveOpacity))

        label.font = font
        label.textColor = color
        label.backgroundColor = .clear
        label.isBezeled = false
        label.isEditable = false
        label.isSelectable = false
        label.alignment = .center
        label.sizeToFit()

        let textSize = label.fittingSize
        let windowWidth = textSize.width + 20 * 2   // horizontalPadding
        let windowHeight = textSize.height + 8 * 2  // verticalPadding
        let windowSize = NSSize(width: windowWidth, height: windowHeight)

        let mbHeight = screen.frame.maxY - screen.visibleFrame.maxY
        let verticalOffset = CGFloat(config.effectiveVerticalOffset)
        let x: CGFloat
        if let sFrame = statusItemFrame {
            x = sFrame.origin.x + (sFrame.width - windowSize.width) / 2
        } else {
            x = screen.frame.origin.x + (screen.frame.width - windowSize.width) / 2
        }
        let y = screen.frame.maxY - mbHeight - windowSize.height - verticalOffset
        let rect = NSRect(x: x, y: y, width: windowSize.width, height: windowSize.height)

        super.init(
            contentRect: rect,
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )

        self.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.floatingWindow)) + 1)
        self.backgroundColor = .clear
        self.isOpaque = false
        self.hasShadow = false
        self.ignoresMouseEvents = true
        self.collectionBehavior = [.canJoinAllSpaces, .stationary]

        let contentV = NSView(frame: NSRect(origin: .zero, size: windowSize))
        contentV.wantsLayer = true
        self.contentView = contentV

        backgroundView.frame = NSRect(origin: .zero, size: windowSize)
        let bgColor = NSColor.fromHex(config.effectiveBackgroundColor)
            .withAlphaComponent(CGFloat(config.effectiveBackgroundOpacity))
        backgroundView.layer?.backgroundColor = bgColor.cgColor
        backgroundView.layer?.cornerRadius = CGFloat(config.effectiveBackgroundCornerRadius)
        contentV.addSubview(backgroundView)

        label.frame = NSRect(
            x: horizontalPadding,
            y: verticalPadding,
            width: textSize.width,
            height: textSize.height
        )
        backgroundView.addSubview(label)
    }

    func updateText(_ text: String, config: InputSourceIndicatorConfig, statusItemFrame: NSRect? = nil) {
        let weight = fontWeight(from: config.effectiveFontWeight)
        let font = NSFont(name: config.effectiveFontName, size: CGFloat(config.effectiveFontSize))
            ?? NSFont.systemFont(ofSize: CGFloat(config.effectiveFontSize), weight: weight)
        let color = NSColor.fromHex(config.effectiveTextColor(for: text))
            .withAlphaComponent(CGFloat(config.effectiveOpacity))

        label.stringValue = config.effectiveDisplayText(for: text)
        label.font = font
        label.textColor = color
        label.sizeToFit()

        let textSize = label.fittingSize
        let windowWidth = textSize.width + horizontalPadding * 2
        let windowHeight = textSize.height + verticalPadding * 2
        let windowSize = NSSize(width: windowWidth, height: windowHeight)

        guard let screen = self.screen ?? NSScreen.main else { return }
        let mbHeight = screen.frame.maxY - screen.visibleFrame.maxY
        let verticalOffset = CGFloat(config.effectiveVerticalOffset)
        let x: CGFloat
        if let sFrame = statusItemFrame {
            x = sFrame.origin.x + (sFrame.width - windowSize.width) / 2
        } else {
            x = screen.frame.origin.x + (screen.frame.width - windowSize.width) / 2
        }
        let y = screen.frame.maxY - mbHeight - windowSize.height - verticalOffset
        let rect = NSRect(x: x, y: y, width: windowSize.width, height: windowSize.height)

        self.setFrame(rect, display: true)
        backgroundView.frame = NSRect(origin: .zero, size: windowSize)

        let bgColor = NSColor.fromHex(config.effectiveBackgroundColor)
            .withAlphaComponent(CGFloat(config.effectiveBackgroundOpacity))
        backgroundView.layer?.backgroundColor = bgColor.cgColor
        backgroundView.layer?.cornerRadius = CGFloat(config.effectiveBackgroundCornerRadius)

        label.frame = NSRect(
            x: horizontalPadding,
            y: verticalPadding,
            width: textSize.width,
            height: textSize.height
        )
    }

    func reposition(on screen: NSScreen, config: InputSourceIndicatorConfig, statusItemFrame: NSRect? = nil) {
        let currentSize = self.frame.size
        let mbHeight = screen.frame.maxY - screen.visibleFrame.maxY
        let verticalOffset = CGFloat(config.effectiveVerticalOffset)
        let x: CGFloat
        if let sFrame = statusItemFrame {
            x = sFrame.origin.x + (sFrame.width - currentSize.width) / 2
        } else {
            x = screen.frame.origin.x + (screen.frame.width - currentSize.width) / 2
        }
        let y = screen.frame.maxY - mbHeight - currentSize.height - verticalOffset
        let rect = NSRect(x: x, y: y, width: currentSize.width, height: currentSize.height)
        self.setFrame(rect, display: true)
    }
}

// MARK: - Input Source Indicator Manager

class InputSourceIndicatorManager {
    private var window: InputSourceIndicatorWindow?
    private var currentDisplayedName: String = ""
    private let spaceDetector: SpaceDetector
    private weak var statusItem: NSStatusItem?
    private var currentConfig: InputSourceIndicatorConfig?
    private var isObserving: Bool = false

    init(spaceDetector: SpaceDetector, statusItem: NSStatusItem) {
        self.spaceDetector = spaceDetector
        self.statusItem = statusItem
    }

    private func statusItemFrame() -> NSRect? {
        return statusItem?.button?.window?.frame
    }

    func start(config: JumpeeConfig) {
        guard config.inputSourceIndicator?.enabled == true else { return }
        let isiConfig = config.inputSourceIndicator!
        currentConfig = isiConfig

        if !isObserving {
            DistributedNotificationCenter.default().addObserver(
                self,
                selector: #selector(inputSourceDidChange(_:)),
                name: NSNotification.Name("AppleSelectedInputSourcesChangedNotification"),
                object: nil,
                suspensionBehavior: .deliverImmediately
            )
            isObserving = true
        }

        let name = getCurrentInputSourceName()
        currentDisplayedName = name

        let screen: NSScreen
        if let spaceInfo = spaceDetector.getCurrentSpaceInfo(),
           let s = spaceDetector.displayIDToScreen(spaceInfo.displayID) {
            screen = s
        } else {
            screen = NSScreen.main ?? NSScreen.screens.first!
        }

        window?.orderOut(nil)
        window = InputSourceIndicatorWindow(screen: screen, text: name, config: isiConfig, statusItemFrame: statusItemFrame())
        window?.orderFront(nil)
    }

    func stop() {
        if isObserving {
            DistributedNotificationCenter.default().removeObserver(self)
            isObserving = false
        }
        window?.orderOut(nil)
        window = nil
        currentDisplayedName = ""
        currentConfig = nil
    }

    func updateConfig(_ config: JumpeeConfig) {
        let wasEnabled = currentConfig != nil
        let nowEnabled = config.inputSourceIndicator?.enabled == true

        if !wasEnabled && nowEnabled {
            start(config: config)
        } else if wasEnabled && !nowEnabled {
            stop()
        } else if wasEnabled && nowEnabled {
            currentConfig = config.inputSourceIndicator
            let name = getCurrentInputSourceName()
            currentDisplayedName = name
            window?.updateText(name, config: currentConfig!, statusItemFrame: statusItemFrame())
            refresh()
        }
    }

    func refresh() {
        guard let config = currentConfig, config.enabled else { return }
        guard let spaceInfo = spaceDetector.getCurrentSpaceInfo() else { return }
        let screen = spaceDetector.displayIDToScreen(spaceInfo.displayID) ?? NSScreen.main
        guard let targetScreen = screen else { return }
        window?.reposition(on: targetScreen, config: config, statusItemFrame: statusItemFrame())
    }

    private func getCurrentInputSourceName() -> String {
        guard let source = TISCopyCurrentKeyboardInputSource()?.takeRetainedValue() else {
            return "Unknown"
        }
        if let namePtr = TISGetInputSourceProperty(source, kTISPropertyLocalizedName) {
            let name = Unmanaged<CFString>.fromOpaque(namePtr).takeUnretainedValue() as String
            return name
        }
        return "Unknown"
    }

    @objc private func inputSourceDidChange(_ notification: Notification) {
        let newName = getCurrentInputSourceName()
        guard newName != currentDisplayedName else { return }
        currentDisplayedName = newName
        guard let config = currentConfig else { return }
        window?.updateText(newName, config: config, statusItemFrame: statusItemFrame())
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
        //    Symbolic hotkey IDs: Desktop 1 = 118, Desktop 2 = 119, ..., Desktop N = 117 + N
        let symbolicHotKey: CGSSymbolicHotKey = UInt32(117 + index)
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
        // Symbolic hotkey 118 = "Switch to Desktop 1"
        return CGSIsSymbolicHotKeyEnabled(118)
    }
}

// MARK: - Pin Overlay Window

/// A borderless, floating, click-through window that mirrors another app's window
/// using CGWindowListCreateImage. This is how Jumpee makes a foreign window appear
/// "always on top" — macOS blocks cross-process window level changes, so we capture
/// the target window and display it in our own floating window.
class PinOverlayWindow: NSWindow {
    let targetWindowID: CGWindowID
    private let imageView: NSImageView
    private var updateTimer: Timer?
    private var lastQuartzBounds: CGRect = .zero
    private var isTargetBeingDragged = false
    private var dragCheckCounter = 0

    init(targetWindowID: CGWindowID, frame: NSRect, initialQuartzBounds: CGRect) {
        self.targetWindowID = targetWindowID
        self.lastQuartzBounds = initialQuartzBounds
        self.imageView = NSImageView()

        super.init(
            contentRect: frame,
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )

        self.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.floatingWindow)))
        self.backgroundColor = .clear
        self.isOpaque = false
        self.hasShadow = true
        self.ignoresMouseEvents = true
        self.collectionBehavior = [.transient]

        imageView.frame = NSRect(origin: .zero, size: frame.size)
        imageView.imageScaling = .scaleAxesIndependently
        imageView.autoresizingMask = [.width, .height]
        self.contentView = imageView

        // Initial capture
        captureAndDisplay()

        // High-frequency timer for smooth tracking (~60 fps)
        updateTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            self?.refreshCapture()
        }
        // Ensure timer fires during mouse tracking (event loop modes)
        RunLoop.main.add(updateTimer!, forMode: .common)
    }

    func stopUpdating() {
        updateTimer?.invalidate()
        updateTimer = nil
    }

    private func refreshCapture() {
        // Check if the target window still exists and get its current bounds
        guard let info = PinOverlayWindow.getWindowInfo(targetWindowID) else {
            print("[Jumpee:Pin] Target window \(targetWindowID) closed, removing overlay")
            stopUpdating()
            WindowPinner.removePinForClosedWindow(self.targetWindowID)
            return
        }

        let currentQuartzBounds = info.bounds

        // Detect if window is being dragged (position changing rapidly)
        let positionChanged = currentQuartzBounds.origin != lastQuartzBounds.origin
        let sizeChanged = currentQuartzBounds.size != lastQuartzBounds.size

        if positionChanged || sizeChanged {
            // During movement: hide overlay to avoid ghost/lag, just track position
            if positionChanged && !sizeChanged {
                dragCheckCounter += 1
                if dragCheckCounter > 2 && !isTargetBeingDragged {
                    isTargetBeingDragged = true
                    self.alphaValue = 0  // Hide during drag
                }
            }

            let cocoaFrame = PinOverlayWindow.quartzToCocoaRect(currentQuartzBounds)
            self.setFrame(cocoaFrame, display: false)
            lastQuartzBounds = currentQuartzBounds
        } else {
            // Window is stationary
            if isTargetBeingDragged {
                // Drag ended — re-show overlay with fresh capture
                isTargetBeingDragged = false
                dragCheckCounter = 0
                captureAndDisplay()
                self.alphaValue = 1
                return
            }
            dragCheckCounter = 0
        }

        // Only capture when not dragging (saves CPU and avoids ghost images)
        if !isTargetBeingDragged {
            captureAndDisplay()
        }
    }

    private func captureAndDisplay() {
        // Capture just the target window using our @_silgen_name wrapper
        // Options: kCGWindowListOptionIncludingWindow = 1 << 3 = 8
        // Image options: kCGWindowImageBoundsIgnoreFraming = 1 << 0 = 1, kCGWindowImageBestResolution = 1 << 3 = 8
        guard let cgImage = JumpeeCGWindowListCreateImage(
            .null,
            8,  // kCGWindowListOptionIncludingWindow
            targetWindowID,
            1 | 8  // boundsIgnoreFraming | bestResolution
        ) else { return }

        let nsImage = NSImage(cgImage: cgImage, size: self.frame.size)
        imageView.image = nsImage
    }

    /// Get window info (bounds, title) from CGWindowListCopyWindowInfo.
    static func getWindowInfo(_ windowID: CGWindowID) -> (bounds: CGRect, title: String)? {
        guard let windowList = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] else {
            return nil
        }

        for info in windowList {
            guard let wid = info[kCGWindowNumber as String] as? CGWindowID,
                  wid == windowID else { continue }

            guard let boundsDict = info[kCGWindowBounds as String] as? [String: CGFloat] else { continue }
            let bounds = CGRect(
                x: boundsDict["X"] ?? 0,
                y: boundsDict["Y"] ?? 0,
                width: boundsDict["Width"] ?? 0,
                height: boundsDict["Height"] ?? 0
            )

            let title = info[kCGWindowName as String] as? String ?? ""
            return (bounds: bounds, title: title)
        }
        return nil
    }

    /// Convert Quartz screen coordinates (origin top-left) to Cocoa coordinates (origin bottom-left).
    static func quartzToCocoaRect(_ quartzRect: CGRect) -> NSRect {
        guard let mainScreen = NSScreen.screens.first else { return NSRect(origin: .zero, size: quartzRect.size) }
        let screenHeight = mainScreen.frame.height
        return NSRect(
            x: quartzRect.origin.x,
            y: screenHeight - quartzRect.origin.y - quartzRect.height,
            width: quartzRect.width,
            height: quartzRect.height
        )
    }

    deinit {
        stopUpdating()
    }
}

// MARK: - Window Pinner

class WindowPinner {
    /// Active overlay windows, keyed by target window ID.
    private static var overlays: [CGWindowID: PinOverlayWindow] = [:]

    /// Toggle pin state of the currently focused window.
    @discardableResult
    static func togglePin() -> String? {
        guard let windowID = getFocusedWindowID() else {
            print("[Jumpee:Pin] Failed: could not get focused window ID")
            return nil
        }
        print("[Jumpee:Pin] Focused window ID: \(windowID)")

        if isPinned(windowID) {
            return unpin(windowID)
        } else {
            return pin(windowID)
        }
    }

    /// Pin a window by creating a floating overlay that mirrors it.
    static func pin(_ windowID: CGWindowID) -> String? {
        // Check if Screen Recording permission is available by trying a capture
        guard let testImage = JumpeeCGWindowListCreateImage(
            .null, 8, windowID, 1  // optionIncludingWindow, boundsIgnoreFraming
        ) else {
            print("[Jumpee:Pin] CGWindowListCreateImage returned nil — Screen Recording permission may be needed")
            promptForScreenRecording()
            return nil
        }

        // Verify the capture isn't blank (permission denied returns a 1x1 or empty image)
        if testImage.width <= 1 || testImage.height <= 1 {
            print("[Jumpee:Pin] Captured image is blank — Screen Recording permission needed")
            promptForScreenRecording()
            return nil
        }

        // Get the target window's current bounds
        guard let info = PinOverlayWindow.getWindowInfo(windowID) else {
            print("[Jumpee:Pin] Could not get window info for \(windowID)")
            return nil
        }

        let cocoaFrame = PinOverlayWindow.quartzToCocoaRect(info.bounds)
        let overlay = PinOverlayWindow(targetWindowID: windowID, frame: cocoaFrame, initialQuartzBounds: info.bounds)
        overlay.orderFront(nil)

        overlays[windowID] = overlay
        print("[Jumpee:Pin] Pinned window \(windowID) (\(info.title)) with capture overlay")
        return "pinned"
    }

    /// Unpin a window by removing its overlay.
    static func unpin(_ windowID: CGWindowID) -> String? {
        guard let overlay = overlays[windowID] else {
            print("[Jumpee:Pin] Window \(windowID) is not pinned")
            return nil
        }

        overlay.stopUpdating()
        overlay.orderOut(nil)
        overlays.removeValue(forKey: windowID)
        print("[Jumpee:Pin] Unpinned window \(windowID)")
        return "unpinned"
    }

    /// Unpin all currently pinned windows.
    static func unpinAll() {
        for (_, overlay) in overlays {
            overlay.stopUpdating()
            overlay.orderOut(nil)
        }
        overlays.removeAll()
    }

    /// Called by PinOverlayWindow when the target window is closed.
    static func removePinForClosedWindow(_ windowID: CGWindowID) {
        if let overlay = overlays[windowID] {
            overlay.orderOut(nil)
            overlays.removeValue(forKey: windowID)
        }
    }

    /// Check if a specific window is currently pinned.
    static func isPinned(_ windowID: CGWindowID) -> Bool {
        return overlays[windowID] != nil
    }

    /// Returns the number of currently pinned windows.
    static var pinnedCount: Int {
        return overlays.count
    }

    /// Check if the currently focused window is pinned.
    static func isFocusedWindowPinned() -> Bool {
        guard let windowID = getFocusedWindowID() else { return false }
        return isPinned(windowID)
    }

    /// Remove entries for windows that no longer exist.
    static func cleanupClosedWindows() {
        let windowList = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
        let existingIDs = Set(windowList.compactMap { $0[kCGWindowNumber as String] as? CGWindowID })

        for windowID in overlays.keys {
            if !existingIDs.contains(windowID) {
                overlays[windowID]?.stopUpdating()
                overlays[windowID]?.orderOut(nil)
                overlays.removeValue(forKey: windowID)
            }
        }
    }

    /// Prompt the user to grant Screen Recording permission.
    private static func promptForScreenRecording() {
        DispatchQueue.main.async {
            let alert = NSAlert()
            alert.messageText = "Screen Recording Permission Required"
            alert.informativeText = """
                To pin windows on top, Jumpee needs Screen Recording \
                permission to capture the window content.

                1. Open System Settings > Privacy & Security > Screen Recording
                2. Enable Jumpee
                3. Try pinning again

                (Jumpee does not record your screen — it only captures \
                the pinned window to display it above other windows.)
                """
            alert.addButton(withTitle: "Open System Settings")
            alert.addButton(withTitle: "Cancel")

            NSApp.activate(ignoringOtherApps: true)
            let response = alert.runModal()

            if response == .alertFirstButtonReturn {
                if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture") {
                    NSWorkspace.shared.open(url)
                }
            }
        }
    }

    // MARK: - Focused window helpers

    /// Get the focused app's AXUIElement and its focused window AXUIElement.
    static func getFocusedAppAndWindow() -> (AXUIElement, AXUIElement)? {
        let systemWide = AXUIElementCreateSystemWide()
        var focusedApp: CFTypeRef?
        guard AXUIElementCopyAttributeValue(systemWide, kAXFocusedApplicationAttribute as CFString, &focusedApp) == .success else {
            return nil
        }

        var focusedWindow: CFTypeRef?
        guard AXUIElementCopyAttributeValue(focusedApp as! AXUIElement, kAXFocusedWindowAttribute as CFString, &focusedWindow) == .success else {
            return nil
        }

        return (focusedApp as! AXUIElement, focusedWindow as! AXUIElement)
    }

    /// Get the CGWindowID of the currently focused window via Accessibility API.
    static func getFocusedWindowID() -> CGWindowID? {
        guard let (_, windowElement) = getFocusedAppAndWindow() else { return nil }

        var windowID: CGWindowID = 0
        let err = _AXUIElementGetWindow(windowElement, &windowID)
        guard err == .success, windowID != 0 else { return nil }
        return windowID
    }
}

// MARK: - Hotkey Slot

private enum HotkeySlot {
    case dropdown
    case moveWindow
    case pinWindow
}

// MARK: - Global Hotkey Manager (Carbon API)

private var globalMenuBarController: MenuBarController?

func hotkeyEventHandler(nextHandler: EventHandlerCallRef?, event: EventRef?, userData: UnsafeMutableRawPointer?) -> OSStatus {
    var hotKeyID = EventHotKeyID()
    let status = GetEventParameter(
        event,
        EventParamName(kEventParamDirectObject),
        EventParamType(typeEventHotKeyID),
        nil,
        MemoryLayout<EventHotKeyID>.size,
        nil,
        &hotKeyID
    )
    guard status == noErr else { return status }

    DispatchQueue.main.async {
        switch hotKeyID.id {
        case 1:
            globalMenuBarController?.openMenu()
        case 2:
            globalMenuBarController?.openMoveWindowMenu()
        case 3:
            globalMenuBarController?.togglePinWindow()
        default:
            break
        }
    }
    return noErr
}

class GlobalHotkeyManager {
    private var hotkeyRef: EventHotKeyRef?
    private var moveWindowHotkeyRef: EventHotKeyRef?
    private var pinWindowHotkeyRef: EventHotKeyRef?
    private var handlerRef: EventHandlerRef?

    func register(config: HotkeyConfig, moveWindowConfig: HotkeyConfig?, pinWindowConfig: HotkeyConfig?) {
        unregister()

        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: UInt32(kEventHotKeyPressed)
        )
        InstallEventHandler(
            GetApplicationEventTarget(),
            hotkeyEventHandler,
            1,
            &eventType,
            nil,
            &handlerRef
        )

        // Register main dropdown hotkey (id=1)
        if let keyCode = config.keyCode {
            let dropdownID = EventHotKeyID(signature: OSType(0x4A4D_5045), id: 1)
            RegisterEventHotKey(
                UInt32(keyCode),
                config.carbonModifiers,
                dropdownID,
                GetApplicationEventTarget(),
                0,
                &hotkeyRef
            )
        }

        // Register move-window hotkey (id=2), only if config provided
        if let mwConfig = moveWindowConfig, let keyCode = mwConfig.keyCode {
            let moveWindowID = EventHotKeyID(signature: OSType(0x4A4D_5045), id: 2)
            RegisterEventHotKey(
                UInt32(keyCode),
                mwConfig.carbonModifiers,
                moveWindowID,
                GetApplicationEventTarget(),
                0,
                &moveWindowHotkeyRef
            )
        }

        // Register pin-window hotkey (id=3), only if config provided
        if let pwConfig = pinWindowConfig, let keyCode = pwConfig.keyCode {
            let pinWindowID = EventHotKeyID(signature: OSType(0x4A4D_5045), id: 3)
            RegisterEventHotKey(
                UInt32(keyCode),
                pwConfig.carbonModifiers,
                pinWindowID,
                GetApplicationEventTarget(),
                0,
                &pinWindowHotkeyRef
            )
        }
    }

    func unregister() {
        if let ref = hotkeyRef {
            UnregisterEventHotKey(ref)
            hotkeyRef = nil
        }
        if let ref = moveWindowHotkeyRef {
            UnregisterEventHotKey(ref)
            moveWindowHotkeyRef = nil
        }
        if let ref = pinWindowHotkeyRef {
            UnregisterEventHotKey(ref)
            pinWindowHotkeyRef = nil
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
    private var inputSourceManager: InputSourceIndicatorManager?

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
        reRegisterHotkeys()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.overlayManager.updateOverlay(config: self!.config)
        }

        if config.inputSourceIndicator?.enabled == true {
            inputSourceManager = InputSourceIndicatorManager(spaceDetector: spaceDetector, statusItem: statusItem)
            inputSourceManager?.start(config: config)
        }
    }

    func openMenu() {
        statusItem.button?.performClick(nil)
    }

    func openMoveWindowMenu() {
        guard config.moveWindow?.enabled == true else { return }

        let menu = NSMenu()
        let displays = spaceDetector.getSpacesByDisplay()
        let currentSpaceID = spaceDetector.getCurrentSpaceID()
        let activeDisplayID = spaceDetector.getActiveDisplayID()

        for display in displays {
            guard display.displayID == activeDisplayID else { continue }

            for space in display.spaces {
                if space.spaceID == currentSpaceID { continue }

                let key = String(space.spaceID)
                let customName = config.spaces[key]
                let displayName: String
                if let name = customName, !name.isEmpty {
                    if config.showSpaceNumber {
                        displayName = "\(space.localPosition): \(name)"
                    } else {
                        displayName = name
                    }
                } else {
                    displayName = "Desktop \(space.localPosition)"
                }

                let item = NSMenuItem(
                    title: displayName,
                    action: #selector(moveWindowFromPopup(_:)),
                    keyEquivalent: ""
                )
                item.target = self
                item.tag = space.globalPosition
                menu.addItem(item)
            }
        }

        guard menu.items.count > 0 else { return }

        let mouseLocation = NSEvent.mouseLocation
        menu.popUp(positioning: nil, at: mouseLocation, in: nil)
    }

    @objc private func moveWindowFromPopup(_ sender: NSMenuItem) {
        let targetGlobalPosition = sender.tag
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            WindowMover.moveToSpace(index: targetGlobalPosition)
        }
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

        let aboutItem = NSMenuItem(
            title: "About Jumpee...",
            action: #selector(showAboutDialog),
            keyEquivalent: ""
        )
        aboutItem.target = self
        menu.addItem(aboutItem)

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

        let isiTitle = config.inputSourceIndicator?.enabled == true
            ? "Disable Input Source Indicator"
            : "Enable Input Source Indicator"
        let isiToggleItem = NSMenuItem(
            title: isiTitle,
            action: #selector(toggleInputSourceIndicator(_:)),
            keyEquivalent: ""
        )
        isiToggleItem.target = self
        isiToggleItem.tag = 102
        menu.addItem(isiToggleItem)

        menu.addItem(NSMenuItem.separator())

        let hotkeysHeader = NSMenuItem(title: "Hotkeys:", action: nil, keyEquivalent: "")
        hotkeysHeader.isEnabled = false
        menu.addItem(hotkeysHeader)

        let dropdownHotkeyItem = NSMenuItem(
            title: "Dropdown Hotkey: \(config.hotkey.displayString)...",
            action: #selector(editDropdownHotkey),
            keyEquivalent: ""
        )
        dropdownHotkeyItem.target = self
        dropdownHotkeyItem.tag = 300
        menu.addItem(dropdownHotkeyItem)

        let moveHotkeyItem = NSMenuItem(
            title: "Move Window Hotkey: \(config.effectiveMoveWindowHotkey.displayString)...",
            action: #selector(editMoveWindowHotkey),
            keyEquivalent: ""
        )
        moveHotkeyItem.target = self
        moveHotkeyItem.tag = 301
        moveHotkeyItem.isHidden = !(config.moveWindow?.enabled == true)
        menu.addItem(moveHotkeyItem)

        let pinHotkeyItem = NSMenuItem(
            title: "Pin Window Hotkey: \(config.effectivePinWindowHotkey.displayString)...",
            action: #selector(editPinWindowHotkey),
            keyEquivalent: ""
        )
        pinHotkeyItem.target = self
        pinHotkeyItem.tag = 302
        pinHotkeyItem.isHidden = !(config.pinWindow?.enabled == true)
        menu.addItem(pinHotkeyItem)

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

        // --- Pin Window items (after Move Window section) ---
        if config.pinWindow?.enabled == true {
            insertIndex += 1

            let sep = NSMenuItem.separator()
            menu.insertItem(sep, at: insertIndex)
            spaceMenuItems.append(sep)
            insertIndex += 1

            // Clean up stale entries before building menu
            WindowPinner.cleanupClosedWindows()

            let isPinned = WindowPinner.isFocusedWindowPinned()
            let pinTitle = isPinned ? "Unpin Current Window" : "Pin Current Window on Top"
            let pinItem = NSMenuItem(title: pinTitle,
                                       action: #selector(pinWindowAction),
                                       keyEquivalent: "")
            pinItem.target = self
            pinItem.tag = 400
            menu.insertItem(pinItem, at: insertIndex)
            spaceMenuItems.append(pinItem)

            if WindowPinner.pinnedCount > 0 {
                insertIndex += 1
                let unpinAllItem = NSMenuItem(title: "Unpin All Windows (\(WindowPinner.pinnedCount))",
                                                action: #selector(unpinAllWindows),
                                                keyEquivalent: "")
                unpinAllItem.target = self
                unpinAllItem.tag = 401
                menu.insertItem(unpinAllItem, at: insertIndex)
                spaceMenuItems.append(unpinAllItem)
            }
        }

        if let toggleItem = menu.item(withTag: 100) {
            toggleItem.title = config.showSpaceNumber ? "Hide Space Number" : "Show Space Number"
        }
        if let overlayItem = menu.item(withTag: 101) {
            overlayItem.title = config.overlay.enabled ? "Disable Overlay" : "Enable Overlay"
        }
        if let isiItem = menu.item(withTag: 102) {
            isiItem.title = config.inputSourceIndicator?.enabled == true
                ? "Disable Input Source Indicator"
                : "Enable Input Source Indicator"
        }

        // Update hotkey menu items
        if let item = menu.item(withTag: 300) {
            item.title = "Dropdown Hotkey: \(config.hotkey.displayString)..."
        }
        if let item = menu.item(withTag: 301) {
            if config.moveWindow?.enabled == true {
                item.title = "Move Window Hotkey: \(config.effectiveMoveWindowHotkey.displayString)..."
                item.isHidden = false
            } else {
                item.isHidden = true
            }
        }
        if let item = menu.item(withTag: 302) {
            if config.pinWindow?.enabled == true {
                item.title = "Pin Window Hotkey: \(config.effectivePinWindowHotkey.displayString)..."
                item.isHidden = false
            } else {
                item.isHidden = true
            }
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
        inputSourceManager?.refresh()
    }

    @objc private func screenParametersDidChange(_ notification: Notification) {
        updateTitle()
        overlayManager.updateOverlay(config: config)
        inputSourceManager?.refresh()
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

    /// Toggle pin state of the focused window. Called from hotkey (id=3).
    func togglePinWindow() {
        guard config.pinWindow?.enabled == true else { return }
        // Small delay to let Jumpee release focus back to the target app
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            WindowPinner.togglePin()
        }
    }

    /// Pin/unpin action from the menu.
    @objc private func pinWindowAction() {
        statusItem.menu?.cancelTracking()
        // Wait for menu to close so the previously-focused app regains focus
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            WindowPinner.togglePin()
        }
    }

    /// Unpin all pinned windows.
    @objc private func unpinAllWindows() {
        WindowPinner.unpinAll()
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

    @objc private func toggleInputSourceIndicator(_ sender: NSMenuItem) {
        if config.inputSourceIndicator == nil {
            config.inputSourceIndicator = InputSourceIndicatorConfig(enabled: true)
        } else {
            config.inputSourceIndicator!.enabled.toggle()
        }
        config.save()

        if config.inputSourceIndicator?.enabled == true {
            if inputSourceManager == nil {
                inputSourceManager = InputSourceIndicatorManager(spaceDetector: spaceDetector, statusItem: statusItem)
            }
            inputSourceManager?.start(config: config)
        } else {
            inputSourceManager?.stop()
        }
    }

    @objc private func showAboutDialog() {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "dev"

        let alert = NSAlert()
        alert.alertStyle = .informational
        alert.messageText = "About Jumpee"
        alert.informativeText = """
            Version: \(version)

            Jumpee displays custom names for your macOS desktops \
            in the menu bar, with a desktop overlay watermark and \
            global hotkey navigation.

            --- macOS Setup Requirements ---

            1. Accessibility Permissions
               System Settings > Privacy & Security > Accessibility
               Add and enable Jumpee.app.

            2. Desktop Switching Shortcuts
               System Settings > Keyboard > Keyboard Shortcuts > \
               Mission Control > Enable "Switch to Desktop 1" \
               through "Switch to Desktop 9" (Ctrl+1 through Ctrl+9).

            3. Window Moving (optional)
               Same shortcuts as above must be enabled. Then set \
               "moveWindow": {"enabled": true} in your config file.

            4. Pin Window on Top (optional)
               Pin any window to float above all others. Set \
               "pinWindow": {"enabled": true} in your config file. \
               Default hotkey: Ctrl+Cmd+P (toggle pin/unpin).

            5. Input Source Indicator (optional)
               Shows the active keyboard input source below \
               the menu bar. Set "inputSourceIndicator": \
               {"enabled": true} in your config file. \
               No additional permissions required.

            --- Configuration ---

            Config file: ~/.Jumpee/config.json
            Open from menu: \u{2318},
            Reload after editing: \u{2318}R

            Hotkeys, overlay style, and space names are all \
            configurable. See the config file for all options.
            """
        alert.addButton(withTitle: "OK")

        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
    }

    @objc private func editDropdownHotkey() {
        editHotkey(slot: .dropdown)
    }

    @objc private func editMoveWindowHotkey() {
        editHotkey(slot: .moveWindow)
    }

    @objc private func editPinWindowHotkey() {
        editHotkey(slot: .pinWindow)
    }

    private func editHotkey(slot: HotkeySlot) {
        let currentConfig: HotkeyConfig
        let slotName: String
        let defaultConfig: HotkeyConfig

        // Collect all OTHER active hotkeys for N-way conflict checking
        var otherHotkeys: [(name: String, config: HotkeyConfig)] = []

        switch slot {
        case .dropdown:
            currentConfig = config.hotkey
            slotName = "Dropdown"
            defaultConfig = HotkeyConfig(key: "j", modifiers: ["command"])
            if config.moveWindow?.enabled == true {
                otherHotkeys.append(("Move Window", config.effectiveMoveWindowHotkey))
            }
            if config.pinWindow?.enabled == true {
                otherHotkeys.append(("Pin Window", config.effectivePinWindowHotkey))
            }
        case .moveWindow:
            currentConfig = config.effectiveMoveWindowHotkey
            slotName = "Move Window"
            defaultConfig = HotkeyConfig(key: "m", modifiers: ["command"])
            otherHotkeys.append(("Dropdown", config.hotkey))
            if config.pinWindow?.enabled == true {
                otherHotkeys.append(("Pin Window", config.effectivePinWindowHotkey))
            }
        case .pinWindow:
            currentConfig = config.effectivePinWindowHotkey
            slotName = "Pin Window"
            defaultConfig = HotkeyConfig(key: "p", modifiers: ["control", "command"])
            otherHotkeys.append(("Dropdown", config.hotkey))
            if config.moveWindow?.enabled == true {
                otherHotkeys.append(("Move Window", config.effectiveMoveWindowHotkey))
            }
        }

        let alert = NSAlert()
        alert.messageText = "Edit \(slotName) Hotkey"
        alert.informativeText = """
            Current: \(currentConfig.displayString)
            Enter a key (a-z, 0-9) and select modifiers.
            """
        alert.addButton(withTitle: "Save")
        alert.addButton(withTitle: "Reset to Default")
        alert.addButton(withTitle: "Cancel")

        let container = NSView(frame: NSRect(x: 0, y: 0, width: 300, height: 100))

        let keyLabel = NSTextField(labelWithString: "Key:")
        keyLabel.frame = NSRect(x: 0, y: 70, width: 40, height: 24)
        container.addSubview(keyLabel)

        let keyField = NSTextField(frame: NSRect(x: 45, y: 70, width: 60, height: 24))
        keyField.stringValue = currentConfig.key
        keyField.placeholderString = "e.g., j"
        container.addSubview(keyField)

        let cmdCheck = NSButton(checkboxWithTitle: "Command", target: nil, action: nil)
        cmdCheck.frame = NSRect(x: 0, y: 40, width: 120, height: 20)
        cmdCheck.state = currentConfig.modifiers.contains(where: {
            $0.lowercased() == "command" || $0.lowercased() == "cmd"
        }) ? .on : .off
        container.addSubview(cmdCheck)

        let ctrlCheck = NSButton(checkboxWithTitle: "Control", target: nil, action: nil)
        ctrlCheck.frame = NSRect(x: 120, y: 40, width: 100, height: 20)
        ctrlCheck.state = currentConfig.modifiers.contains(where: {
            $0.lowercased() == "control" || $0.lowercased() == "ctrl"
        }) ? .on : .off
        container.addSubview(ctrlCheck)

        let optCheck = NSButton(checkboxWithTitle: "Option", target: nil, action: nil)
        optCheck.frame = NSRect(x: 0, y: 15, width: 120, height: 20)
        optCheck.state = currentConfig.modifiers.contains(where: {
            $0.lowercased() == "option" || $0.lowercased() == "alt"
        }) ? .on : .off
        container.addSubview(optCheck)

        let shiftCheck = NSButton(checkboxWithTitle: "Shift", target: nil, action: nil)
        shiftCheck.frame = NSRect(x: 120, y: 15, width: 100, height: 20)
        shiftCheck.state = currentConfig.modifiers.contains(where: {
            $0.lowercased() == "shift"
        }) ? .on : .off
        container.addSubview(shiftCheck)

        alert.accessoryView = container
        alert.window.initialFirstResponder = keyField

        NSApp.activate(ignoringOtherApps: true)
        let response = alert.runModal()

        if response == .alertFirstButtonReturn {
            // Save
            let rawKey = keyField.stringValue
                .lowercased()
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let newKey = String(rawKey.prefix(1))

            var newModifiers: [String] = []
            if cmdCheck.state == .on { newModifiers.append("command") }
            if ctrlCheck.state == .on { newModifiers.append("control") }
            if optCheck.state == .on { newModifiers.append("option") }
            if shiftCheck.state == .on { newModifiers.append("shift") }

            guard !newModifiers.isEmpty else {
                showValidationError(
                    title: "Invalid Hotkey",
                    message: "At least one modifier (Command, Control, Option, Shift) must be selected."
                )
                return
            }

            let newConfig = HotkeyConfig(key: newKey, modifiers: newModifiers)
            guard newConfig.keyCode != nil else {
                showValidationError(
                    title: "Unsupported Key",
                    message: "The key '\(newKey)' is not supported. Use a-z, 0-9, space, return, tab, or escape."
                )
                return
            }

            // Check for conflict with all other active Jumpee hotkeys
            let newModsNormalized = Set(newModifiers.map { $0.lowercased() })
            for other in otherHotkeys {
                let otherModsNormalized = Set(other.config.modifiers.map { $0.lowercased() })
                if newConfig.key.lowercased() == other.config.key.lowercased()
                    && newModsNormalized == otherModsNormalized {
                    showValidationError(
                        title: "Hotkey Conflict",
                        message: "This combination is already used by the \(other.name) hotkey (\(other.config.displayString))."
                    )
                    return
                }
            }

            switch slot {
            case .dropdown:
                config.hotkey = newConfig
            case .moveWindow:
                config.moveWindowHotkey = newConfig
            case .pinWindow:
                config.pinWindowHotkey = newConfig
            }
            config.save()
            reRegisterHotkeys()

        } else if response == .alertSecondButtonReturn {
            // Reset to Default
            switch slot {
            case .dropdown:
                config.hotkey = defaultConfig
            case .moveWindow:
                config.moveWindowHotkey = defaultConfig
            case .pinWindow:
                config.pinWindowHotkey = defaultConfig
            }
            config.save()
            reRegisterHotkeys()
        }
    }

    private func showValidationError(title: String, message: String) {
        let errAlert = NSAlert()
        errAlert.messageText = title
        errAlert.informativeText = message
        errAlert.alertStyle = .warning
        errAlert.addButton(withTitle: "OK")
        errAlert.runModal()
    }

    private func reRegisterHotkeys() {
        hotkeyManager?.register(
            config: config.hotkey,
            moveWindowConfig: config.moveWindow?.enabled == true
                ? config.effectiveMoveWindowHotkey
                : nil,
            pinWindowConfig: config.pinWindow?.enabled == true
                ? config.effectivePinWindowHotkey
                : nil
        )
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
        reRegisterHotkeys()

        if config.inputSourceIndicator?.enabled == true {
            if inputSourceManager == nil {
                inputSourceManager = InputSourceIndicatorManager(spaceDetector: spaceDetector, statusItem: statusItem)
            }
            inputSourceManager?.updateConfig(config)
        } else {
            inputSourceManager?.stop()
        }
    }

    @objc private func quit(_ sender: NSMenuItem) {
        inputSourceManager?.stop()
        WindowPinner.unpinAll()
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
