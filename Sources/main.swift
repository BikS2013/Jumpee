import Cocoa
import Carbon.HIToolbox

// MARK: - Private CGS API Declarations

@_silgen_name("CGSMainConnectionID")
func CGSMainConnectionID() -> Int32

@_silgen_name("CGSGetActiveSpace")
func CGSGetActiveSpace(_ cid: Int32) -> Int

@_silgen_name("CGSCopyManagedDisplaySpaces")
func CGSCopyManagedDisplaySpaces(_ cid: Int32) -> CFArray


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

struct JumpeeConfig: Codable {
    var spaces: [String: String]
    var showSpaceNumber: Bool
    var overlay: OverlayConfig
    var hotkey: HotkeyConfig

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

        guard let screen = NSScreen.main else { return }
        guard let spaceIndex = spaceDetector.getCurrentSpaceIndex() else { return }

        let spaceID = spaceDetector.getCurrentSpaceID()
        let key = String(spaceID)
        let customName = config.spaces[key]

        let displayText: String
        if let name = customName, !name.isEmpty {
            if config.showSpaceNumber {
                displayText = "\(spaceIndex): \(name)"
            } else {
                displayText = name
            }
        } else {
            displayText = "Desktop \(spaceIndex)"
        }

        if let existing = overlayWindow {
            existing.updateText(displayText, config: config.overlay)
        } else {
            let window = OverlayWindow(screen: screen, text: displayText, config: config.overlay)
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

    private static func keyCodeForNumber(_ n: Int) -> Int {
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
        guard let index = spaceDetector.getCurrentSpaceIndex() else {
            statusItem.button?.title = "?"
            return
        }

        let key = String(spaceDetector.getCurrentSpaceID())
        if let customName = config.spaces[key], !customName.isEmpty {
            if config.showSpaceNumber {
                statusItem.button?.title = "\(index): \(customName)"
            } else {
                statusItem.button?.title = customName
            }
        } else {
            statusItem.button?.title = "Desktop \(index)"
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

        let orderedSpaces = spaceDetector.getOrderedSpaces()
        let currentSpaceID = spaceDetector.getCurrentSpaceID()

        for (position, spaceID) in orderedSpaces {
            let key = String(spaceID)
            let customName = config.spaces[key]

            let displayName: String
            if let name = customName, !name.isEmpty {
                displayName = "Desktop \(position) - \(name)"
            } else {
                displayName = "Desktop \(position)"
            }

            let keyEquiv = position <= 9 ? String(position) : ""
            let item = NSMenuItem(title: displayName, action: #selector(navigateToSpace(_:)), keyEquivalent: keyEquiv)
            item.keyEquivalentModifierMask = .command
            item.target = self
            item.tag = position

            if currentSpaceID == spaceID {
                item.state = .on
            }

            menu.insertItem(item, at: insertIndex)
            spaceMenuItems.append(item)
            insertIndex += 1
        }

        let renameItem = NSMenuItem(title: "Rename Current Desktop...", action: #selector(renameActiveSpace), keyEquivalent: "n")
        renameItem.target = self
        renameItem.tag = 200
        menu.insertItem(renameItem, at: insertIndex)
        spaceMenuItems.append(renameItem)

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
    }

    @objc private func spaceDidChange(_ notification: Notification) {
        updateTitle()
        overlayManager.updateOverlay(config: config)
    }

    @objc private func navigateToSpace(_ sender: NSMenuItem) {
        let spaceIndex = sender.tag
        let currentIndex = spaceDetector.getCurrentSpaceIndex()
        if spaceIndex != currentIndex {
            statusItem.menu?.cancelTracking()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                SpaceNavigator.navigateToSpace(index: spaceIndex)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self?.openMenu()
                }
            }
        }
    }

    @objc private func renameActiveSpace() {
        guard let spaceIndex = spaceDetector.getCurrentSpaceIndex() else { return }
        let spaceID = spaceDetector.getCurrentSpaceID()
        let key = String(spaceID)
        let currentName = config.spaces[key] ?? ""

        let alert = NSAlert()
        alert.messageText = "Rename Desktop \(spaceIndex)"
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
