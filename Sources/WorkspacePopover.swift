import Cocoa

struct WorkspacePopoverSpaceItem {
    let spaceID: Int
    let localPosition: Int
    let globalPosition: Int
    let name: String
    let shortcut: String?
    let isCurrent: Bool
}

struct WorkspacePopoverDisplaySection {
    let name: String
    let spaces: [WorkspacePopoverSpaceItem]
}

struct WorkspacePopoverSnapshot {
    let currentTitle: String
    let currentSubtitle: String
    let displays: [WorkspacePopoverDisplaySection]
    let overlayEnabled: Bool
    let inputSourceEnabled: Bool
    let moveWindowEnabled: Bool
    let pinWindowEnabled: Bool
    let currentWindowPinned: Bool
    let pinnedWindowCount: Int
}

private final class WorkspacePopoverFlippedView: NSView {
    override var isFlipped: Bool { true }
}

private final class WorkspacePopoverRowView: NSView {
    private let actionButton = NSButton()
    private var trackingAreaReference: NSTrackingArea?
    private var isHovered = false
    private let isCurrent: Bool

    var action: (() -> Void)?
    /// Keyboard selection from the filter field's arrow keys.
    var isSelected = false {
        didSet { updateBackground() }
    }

    init(item: WorkspacePopoverSpaceItem) {
        isCurrent = item.isCurrent
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 9

        let icon = NSImageView(image: NSImage(systemSymbolName: "display", accessibilityDescription: nil) ?? NSImage())
        icon.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 17, weight: .medium)
        icon.contentTintColor = item.isCurrent ? .controlAccentColor : .labelColor

        let number = NSTextField(labelWithString: String(item.localPosition))
        number.font = .monospacedDigitSystemFont(ofSize: 13, weight: .medium)
        number.alignment = .right

        let name = NSTextField(labelWithString: item.name)
        name.font = .systemFont(ofSize: 13)
        name.lineBreakMode = .byTruncatingTail

        let shortcut = NSTextField(labelWithString: item.shortcut ?? "")
        shortcut.font = .systemFont(ofSize: 12)
        shortcut.textColor = .secondaryLabelColor
        shortcut.alignment = .right

        let check = NSImageView()
        if item.isCurrent {
            check.image = NSImage(systemSymbolName: "checkmark.circle.fill", accessibilityDescription: "Current desktop")
            check.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 17, weight: .medium)
            check.contentTintColor = .controlAccentColor
        }

        for child in [icon, number, name, shortcut, check, actionButton] {
            child.translatesAutoresizingMaskIntoConstraints = false
            addSubview(child)
        }

        actionButton.title = "Switch to Desktop \(item.localPosition), \(item.name)"
        actionButton.isBordered = false
        actionButton.isTransparent = true
        actionButton.target = self
        actionButton.action = #selector(performAction)
        actionButton.setAccessibilityLabel("Switch to Desktop \(item.localPosition), \(item.name)")
        if item.globalPosition <= 9 {
            toolTip = "⌃\(item.globalPosition) jumps straight to this desktop from any app"
        }

        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: 44),
            icon.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            icon.centerYAnchor.constraint(equalTo: centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 24),
            icon.heightAnchor.constraint(equalToConstant: 24),
            number.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 8),
            number.centerYAnchor.constraint(equalTo: centerYAnchor),
            number.widthAnchor.constraint(equalToConstant: 22),
            name.leadingAnchor.constraint(equalTo: number.trailingAnchor, constant: 12),
            name.centerYAnchor.constraint(equalTo: centerYAnchor),
            shortcut.leadingAnchor.constraint(greaterThanOrEqualTo: name.trailingAnchor, constant: 8),
            shortcut.trailingAnchor.constraint(equalTo: check.leadingAnchor, constant: -10),
            shortcut.centerYAnchor.constraint(equalTo: centerYAnchor),
            shortcut.widthAnchor.constraint(equalToConstant: 36),
            check.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
            check.centerYAnchor.constraint(equalTo: centerYAnchor),
            check.widthAnchor.constraint(equalToConstant: 20),
            check.heightAnchor.constraint(equalToConstant: 20),
            actionButton.leadingAnchor.constraint(equalTo: leadingAnchor),
            actionButton.trailingAnchor.constraint(equalTo: trailingAnchor),
            actionButton.topAnchor.constraint(equalTo: topAnchor),
            actionButton.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
        updateBackground()
    }

    required init?(coder: NSCoder) { nil }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let trackingAreaReference { removeTrackingArea(trackingAreaReference) }
        let area = NSTrackingArea(
            rect: bounds,
            options: [.activeAlways, .mouseEnteredAndExited, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(area)
        trackingAreaReference = area
    }

    override func mouseEntered(with event: NSEvent) {
        isHovered = true
        updateBackground()
    }

    override func mouseExited(with event: NSEvent) {
        isHovered = false
        updateBackground()
    }

    private func updateBackground() {
        layer?.borderWidth = isSelected ? 1.5 : 0
        layer?.borderColor = NSColor.controlAccentColor.cgColor
        if isSelected {
            layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.24).cgColor
        } else if isCurrent {
            layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(isHovered ? 0.22 : 0.14).cgColor
        } else if isHovered {
            layer?.backgroundColor = NSColor.quaternaryLabelColor.cgColor
        } else {
            layer?.backgroundColor = NSColor.clear.cgColor
        }
    }

    @objc private func performAction() {
        action?()
    }
}

private final class WorkspacePopoverActionButton: NSView {
    private let iconView = NSImageView()
    private let titleLabel = NSTextField(labelWithString: "")
    private let shortcutLabel = NSTextField(labelWithString: "")
    private let clickButton = NSButton()
    private var trackingAreaReference: NSTrackingArea?
    private var isHovered = false

    var action: (() -> Void)?
    var isEnabled: Bool = true {
        didSet {
            clickButton.isEnabled = isEnabled
            updateAppearance()
        }
    }

    override var intrinsicContentSize: NSSize {
        NSSize(width: 104, height: 72)
    }

    /// - Parameter shortcut: Key combination that triggers the action while the popover
    ///   is open (e.g. "⌘N"), shown under the title so it is discoverable.
    init(title: String, symbol: String, shortcut: String) {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 9
        layer?.borderWidth = 1

        iconView.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 18, weight: .medium)
        iconView.contentTintColor = .labelColor
        titleLabel.font = .systemFont(ofSize: 12, weight: .medium)
        titleLabel.alignment = .center
        titleLabel.lineBreakMode = .byTruncatingTail
        shortcutLabel.stringValue = shortcut
        shortcutLabel.font = .monospacedSystemFont(ofSize: 10.5, weight: .regular)
        shortcutLabel.textColor = .secondaryLabelColor
        shortcutLabel.alignment = .center

        clickButton.title = ""
        clickButton.isBordered = false
        clickButton.isTransparent = true
        clickButton.target = self
        clickButton.action = #selector(performAction)

        let content = NSStackView(views: [iconView, titleLabel, shortcutLabel])
        content.orientation = .vertical
        content.alignment = .centerX
        content.spacing = 3
        content.setCustomSpacing(1, after: titleLabel)

        for child in [content, clickButton] {
            child.translatesAutoresizingMaskIntoConstraints = false
            addSubview(child)
        }
        NSLayoutConstraint.activate([
            content.centerXAnchor.constraint(equalTo: centerXAnchor),
            content.centerYAnchor.constraint(equalTo: centerYAnchor),
            content.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 8),
            content.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -8),
            iconView.widthAnchor.constraint(equalToConstant: 24),
            iconView.heightAnchor.constraint(equalToConstant: 24),
            clickButton.leadingAnchor.constraint(equalTo: leadingAnchor),
            clickButton.trailingAnchor.constraint(equalTo: trailingAnchor),
            clickButton.topAnchor.constraint(equalTo: topAnchor),
            clickButton.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
        configure(title: title, symbol: symbol)
        updateAppearance()
    }

    required init?(coder: NSCoder) { nil }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let trackingAreaReference { removeTrackingArea(trackingAreaReference) }
        let area = NSTrackingArea(
            rect: bounds,
            options: [.activeAlways, .mouseEnteredAndExited, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(area)
        trackingAreaReference = area
    }

    override func mouseEntered(with event: NSEvent) {
        isHovered = true
        updateAppearance()
    }

    override func mouseExited(with event: NSEvent) {
        isHovered = false
        updateAppearance()
    }

    func configure(title: String, symbol: String) {
        titleLabel.stringValue = title
        iconView.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)
        clickButton.setAccessibilityLabel("\(title), \(shortcutLabel.stringValue)")
    }

    private func updateAppearance() {
        alphaValue = isEnabled ? 1 : 0.45
        layer?.backgroundColor = (isHovered && isEnabled
            ? NSColor.controlAccentColor.withAlphaComponent(0.13)
            : NSColor.controlBackgroundColor.withAlphaComponent(0.72)).cgColor
        layer?.borderColor = (isHovered && isEnabled
            ? NSColor.controlAccentColor.withAlphaComponent(0.32)
            : NSColor.separatorColor.withAlphaComponent(0.70)).cgColor
    }

    @objc private func performAction() {
        guard isEnabled else { return }
        action?()
    }
}

private final class WorkspacePopoverContentViewController: NSViewController, NSSearchFieldDelegate {
    private let currentTitle = NSTextField(labelWithString: "")
    private let currentSubtitle = NSTextField(labelWithString: "")
    private let searchField = NSSearchField()
    private let scrollView = NSScrollView()
    private let documentView = WorkspacePopoverFlippedView()
    private let desktopStack = NSStackView()
    private let renameButton = WorkspacePopoverActionButton(title: "Rename", symbol: "pencil", shortcut: "⌘N")
    private let moveButton = WorkspacePopoverActionButton(title: "Move Window", symbol: "rectangle.on.rectangle", shortcut: "⌘M")
    private let pinButton = WorkspacePopoverActionButton(title: "Pin Window", symbol: "pin", shortcut: "⌘P")
    private let statusDot = NSView()
    private let statusLabel = NSTextField(labelWithString: "")
    private let settingsButton = NSButton()
    private let resetDockButton = NSButton()
    private let moreButton = NSButton()
    private let hintLabel = NSTextField(labelWithString: "")
    private var snapshot: WorkspacePopoverSnapshot?
    /// Rows currently shown (after filtering), in list order, with their items.
    private var visibleRows: [(row: WorkspacePopoverRowView, item: WorkspacePopoverSpaceItem)] = []
    private var selectedIndex: Int?

    var onNavigate: ((Int) -> Void)?
    var onDismiss: (() -> Void)?
    var onRename: (() -> Void)?
    var onMoveWindow: (() -> Void)?
    var onPinWindow: (() -> Void)?
    var onUnpinAll: (() -> Void)?
    var onSettings: (() -> Void)?
    var onResetDock: (() -> Void)?
    var onAbout: (() -> Void)?
    var onQuit: (() -> Void)?

    override func loadView() {
        let root = NSView(frame: NSRect(x: 0, y: 0, width: 380, height: 590))
        view = root

        let iconContainer = NSBox()
        iconContainer.boxType = .custom
        iconContainer.cornerRadius = 12
        iconContainer.borderWidth = 1
        iconContainer.borderColor = NSColor.controlAccentColor.withAlphaComponent(0.15)
        iconContainer.fillColor = NSColor.controlAccentColor.withAlphaComponent(0.10)
        let icon = NSImageView(image: NSImage(systemSymbolName: "display", accessibilityDescription: "Current desktop") ?? NSImage())
        icon.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 27, weight: .medium)
        icon.contentTintColor = .controlAccentColor
        icon.translatesAutoresizingMaskIntoConstraints = false
        iconContainer.contentView?.addSubview(icon)

        currentTitle.font = .systemFont(ofSize: 17, weight: .semibold)
        currentTitle.lineBreakMode = .byTruncatingTail
        currentSubtitle.font = .systemFont(ofSize: 12)
        currentSubtitle.textColor = .secondaryLabelColor
        let titleStack = NSStackView(views: [currentTitle, currentSubtitle])
        titleStack.orientation = .vertical
        titleStack.alignment = .leading
        titleStack.spacing = 3

        moreButton.image = NSImage(systemSymbolName: "ellipsis", accessibilityDescription: "More actions")
        moreButton.bezelStyle = .circular
        moreButton.target = self
        moreButton.action = #selector(showMoreMenu)
        moreButton.toolTip = "More actions"

        searchField.placeholderString = "Filter desktops"
        searchField.delegate = self
        searchField.sendsSearchStringImmediately = true

        scrollView.borderType = .noBorder
        scrollView.drawsBackground = false
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.documentView = documentView
        desktopStack.orientation = .vertical
        desktopStack.alignment = .leading
        desktopStack.distribution = .fill
        desktopStack.spacing = 4
        documentView.addSubview(desktopStack)

        renameButton.action = { [weak self] in self?.onRename?() }
        moveButton.action = { [weak self] in self?.onMoveWindow?() }
        pinButton.action = { [weak self] in self?.onPinWindow?() }
        let actionStack = NSStackView(views: [renameButton, moveButton, pinButton])
        actionStack.orientation = .horizontal
        actionStack.distribution = .fillEqually
        actionStack.spacing = 10

        statusDot.wantsLayer = true
        statusDot.layer?.cornerRadius = 5
        statusLabel.font = .systemFont(ofSize: 11)
        statusLabel.textColor = .secondaryLabelColor
        statusLabel.lineBreakMode = .byTruncatingTail
        statusLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        settingsButton.title = "Settings…  ⌘,"
        let settingsTitle = NSMutableAttributedString(string: "Settings…  ⌘,")
        settingsTitle.addAttributes(
            [.foregroundColor: NSColor.secondaryLabelColor, .font: NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)],
            range: NSRange(location: settingsTitle.length - 2, length: 2)
        )
        settingsButton.attributedTitle = settingsTitle
        settingsButton.toolTip = "Open Settings (⌘,)"
        settingsButton.image = NSImage(systemSymbolName: "gearshape", accessibilityDescription: nil)
        settingsButton.imagePosition = .imageLeading
        settingsButton.bezelStyle = .rounded
        settingsButton.target = self
        settingsButton.action = #selector(openSettings)
        resetDockButton.title = "Reset Dock"
        resetDockButton.image = NSImage(systemSymbolName: "arrow.clockwise", accessibilityDescription: nil)
        resetDockButton.imagePosition = .imageLeading
        resetDockButton.bezelStyle = .rounded
        resetDockButton.target = self
        resetDockButton.action = #selector(resetDock)
        resetDockButton.toolTip = "Restart the Dock. Use it when ⌃1–⌃9 or desktop switching stop working: they are handled by the Dock, which can get stuck. Windows and desktops are kept."
        resetDockButton.setAccessibilityLabel("Reset Dock")

        hintLabel.font = .systemFont(ofSize: 11)
        hintLabel.textColor = .secondaryLabelColor
        hintLabel.lineBreakMode = .byTruncatingTail
        hintLabel.maximumNumberOfLines = 1

        let footerStack = NSStackView(views: [statusDot, statusLabel, resetDockButton, settingsButton])
        footerStack.orientation = .horizontal
        footerStack.alignment = .centerY
        footerStack.spacing = 8

        let upperSeparator = NSBox()
        upperSeparator.boxType = .separator
        let lowerSeparator = NSBox()
        lowerSeparator.boxType = .separator

        for child in [iconContainer, titleStack, moreButton, searchField, scrollView, hintLabel, upperSeparator, actionStack, lowerSeparator, footerStack] {
            child.translatesAutoresizingMaskIntoConstraints = false
            root.addSubview(child)
        }

        NSLayoutConstraint.activate([
            iconContainer.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 18),
            iconContainer.topAnchor.constraint(equalTo: root.topAnchor, constant: 18),
            iconContainer.widthAnchor.constraint(equalToConstant: 56),
            iconContainer.heightAnchor.constraint(equalToConstant: 56),
            icon.centerXAnchor.constraint(equalTo: iconContainer.contentView!.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconContainer.contentView!.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 34),
            icon.heightAnchor.constraint(equalToConstant: 34),

            titleStack.leadingAnchor.constraint(equalTo: iconContainer.trailingAnchor, constant: 14),
            titleStack.centerYAnchor.constraint(equalTo: iconContainer.centerYAnchor),
            titleStack.trailingAnchor.constraint(lessThanOrEqualTo: moreButton.leadingAnchor, constant: -10),
            moreButton.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -18),
            moreButton.centerYAnchor.constraint(equalTo: iconContainer.centerYAnchor),
            moreButton.widthAnchor.constraint(equalToConstant: 34),
            moreButton.heightAnchor.constraint(equalToConstant: 34),

            searchField.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 18),
            searchField.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -18),
            searchField.topAnchor.constraint(equalTo: iconContainer.bottomAnchor, constant: 16),
            searchField.heightAnchor.constraint(equalToConstant: 34),

            scrollView.leadingAnchor.constraint(equalTo: searchField.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: searchField.trailingAnchor),
            scrollView.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 10),
            scrollView.heightAnchor.constraint(equalToConstant: 262),

            hintLabel.leadingAnchor.constraint(equalTo: searchField.leadingAnchor, constant: 2),
            hintLabel.trailingAnchor.constraint(equalTo: searchField.trailingAnchor, constant: -2),
            hintLabel.topAnchor.constraint(equalTo: scrollView.bottomAnchor, constant: 8),

            upperSeparator.leadingAnchor.constraint(equalTo: searchField.leadingAnchor),
            upperSeparator.trailingAnchor.constraint(equalTo: searchField.trailingAnchor),
            upperSeparator.topAnchor.constraint(equalTo: hintLabel.bottomAnchor, constant: 8),

            actionStack.leadingAnchor.constraint(equalTo: searchField.leadingAnchor),
            actionStack.trailingAnchor.constraint(equalTo: searchField.trailingAnchor),
            actionStack.topAnchor.constraint(equalTo: upperSeparator.bottomAnchor, constant: 12),
            actionStack.heightAnchor.constraint(equalToConstant: 72),

            lowerSeparator.leadingAnchor.constraint(equalTo: searchField.leadingAnchor),
            lowerSeparator.trailingAnchor.constraint(equalTo: searchField.trailingAnchor),
            lowerSeparator.topAnchor.constraint(equalTo: actionStack.bottomAnchor, constant: 12),

            footerStack.leadingAnchor.constraint(equalTo: searchField.leadingAnchor),
            footerStack.trailingAnchor.constraint(equalTo: searchField.trailingAnchor),
            footerStack.topAnchor.constraint(equalTo: lowerSeparator.bottomAnchor, constant: 10),
            footerStack.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -12),
            statusDot.widthAnchor.constraint(equalToConstant: 10),
            statusDot.heightAnchor.constraint(equalToConstant: 10),
            settingsButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 104),
            resetDockButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 96),
        ])
    }

    func update(with snapshot: WorkspacePopoverSnapshot) {
        self.snapshot = snapshot
        currentTitle.stringValue = snapshot.currentTitle
        currentSubtitle.stringValue = snapshot.currentSubtitle
        moveButton.isEnabled = snapshot.moveWindowEnabled
        moveButton.toolTip = snapshot.moveWindowEnabled ? "Choose a desktop for the focused window" : "Enable window moving in Settings"
        pinButton.isEnabled = snapshot.pinWindowEnabled
        pinButton.configure(
            title: snapshot.currentWindowPinned ? "Unpin Window" : "Pin Window",
            symbol: snapshot.currentWindowPinned ? "pin.slash" : "pin"
        )
        pinButton.toolTip = snapshot.pinWindowEnabled ? "Keep the focused window above others" : "Enable window pinning in Settings"

        let enabledFeatures: [String] = [
            snapshot.overlayEnabled ? "Overlay" : nil,
            snapshot.inputSourceEnabled ? "input source indicator" : nil,
        ].compactMap { $0 }
        if enabledFeatures.isEmpty {
            statusDot.layer?.backgroundColor = NSColor.tertiaryLabelColor.cgColor
            statusLabel.stringValue = "Visual indicators are off"
        } else {
            statusDot.layer?.backgroundColor = NSColor.systemGreen.cgColor
            statusLabel.stringValue = enabledFeatures.joined(separator: " and ") + (enabledFeatures.count == 1 ? " is on" : " are on")
        }
        rebuildDesktopRows()
    }

    func handleKeyEvent(_ event: NSEvent) -> Bool {
        if event.keyCode == 53 {
            onDismiss?()
            return true
        }
        let modifiers = event.modifierFlags.intersection([.command, .control, .option, .shift])
        guard modifiers == .command, let key = event.charactersIgnoringModifiers?.lowercased() else { return false }
        if let number = Int(key), (1...9).contains(number),
           let space = snapshot?.displays.flatMap(\.spaces).first(where: { $0.shortcut == "⌘\(number)" }) {
            onNavigate?(space.globalPosition)
            return true
        }
        switch key {
        case "n": onRename?(); return true
        case "m":
            guard moveButton.isEnabled else { return true }
            onMoveWindow?(); return true
        case "p":
            guard pinButton.isEnabled else { return true }
            onPinWindow?(); return true
        case ",": onSettings?(); return true
        case "q": onQuit?(); return true
        default: return false
        }
    }

    func controlTextDidChange(_ notification: Notification) {
        rebuildDesktopRows()
        // While filtering, keep the first match selected so Return switches to it.
        let query = searchField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        select(query.isEmpty || visibleRows.isEmpty ? nil : 0)
    }

    /// Arrow keys and Return in the filter field drive the desktop list below it.
    func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
        switch commandSelector {
        case #selector(NSResponder.moveDown(_:)):
            guard !visibleRows.isEmpty else { return true }
            select(selectedIndex.map { min($0 + 1, visibleRows.count - 1) } ?? 0)
            return true
        case #selector(NSResponder.moveUp(_:)):
            guard !visibleRows.isEmpty else { return true }
            select(selectedIndex.map { max($0 - 1, 0) } ?? visibleRows.count - 1)
            return true
        case #selector(NSResponder.insertNewline(_:)):
            guard let selectedIndex, visibleRows.indices.contains(selectedIndex) else { return true }
            onNavigate?(visibleRows[selectedIndex].item.globalPosition)
            return true
        default:
            return false
        }
    }

    private func select(_ index: Int?) {
        selectedIndex = index
        for (offset, entry) in visibleRows.enumerated() {
            entry.row.isSelected = offset == index
        }
        if let index, visibleRows.indices.contains(index) {
            let row = visibleRows[index].row
            row.scrollToVisible(row.bounds.insetBy(dx: 0, dy: -6))
        }
        updateHint()
    }

    private func updateHint() {
        if let selectedIndex, visibleRows.indices.contains(selectedIndex) {
            let item = visibleRows[selectedIndex].item
            if item.globalPosition <= 9 {
                hintLabel.stringValue = "⌃\(item.globalPosition) jumps straight to “\(item.name)” from any app · ↩ switches now"
            } else {
                hintLabel.stringValue = "↩ switches to “\(item.name)” · no ⌃ shortcut beyond Desktop 9"
            }
        } else {
            hintLabel.stringValue = "Tip: ⌃1–⌃9 jump straight to a desktop from any app · ↑↓ select"
        }
    }

    private func rebuildDesktopRows() {
        for child in desktopStack.arrangedSubviews {
            desktopStack.removeArrangedSubview(child)
            child.removeFromSuperview()
        }
        visibleRows = []
        selectedIndex = nil
        guard let snapshot else { updateHint(); return }
        let query = searchField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        var contentHeight: CGFloat = 0
        var resultCount = 0

        for display in snapshot.displays {
            let matches = display.spaces.filter { space in
                query.isEmpty
                    || space.name.lowercased().contains(query)
                    || "desktop \(space.localPosition)".contains(query)
            }
            guard !matches.isEmpty else { continue }

            let displayLabel = NSTextField(labelWithString: display.name.uppercased())
            displayLabel.font = .systemFont(ofSize: 11, weight: .semibold)
            displayLabel.textColor = .secondaryLabelColor
            displayLabel.setContentHuggingPriority(.required, for: .vertical)
            displayLabel.heightAnchor.constraint(equalToConstant: 24).isActive = true
            desktopStack.addArrangedSubview(displayLabel)
            displayLabel.widthAnchor.constraint(equalTo: desktopStack.widthAnchor).isActive = true
            contentHeight += 28

            for item in matches {
                let row = WorkspacePopoverRowView(item: item)
                row.action = { [weak self] in self?.onNavigate?(item.globalPosition) }
                visibleRows.append((row, item))
                desktopStack.addArrangedSubview(row)
                row.widthAnchor.constraint(equalTo: desktopStack.widthAnchor).isActive = true
                contentHeight += 48
                resultCount += 1
            }
        }

        if resultCount == 0 {
            let empty = NSTextField(wrappingLabelWithString: "No desktops match “\(searchField.stringValue)”.")
            empty.alignment = .center
            empty.textColor = .secondaryLabelColor
            empty.heightAnchor.constraint(equalToConstant: 70).isActive = true
            desktopStack.addArrangedSubview(empty)
            empty.widthAnchor.constraint(equalTo: desktopStack.widthAnchor).isActive = true
            contentHeight = 70
        }

        let width = max(scrollView.contentSize.width, 330)
        let height = max(contentHeight, scrollView.contentSize.height)
        documentView.frame = NSRect(x: 0, y: 0, width: width, height: height)
        desktopStack.frame = documentView.bounds.insetBy(dx: 0, dy: 2)
        desktopStack.autoresizingMask = [.width, .height]
        updateHint()
    }

    @objc private func openSettings() { onSettings?() }
    @objc private func resetDock() { onResetDock?() }

    @objc private func showMoreMenu() {
        let menu = NSMenu()
        if let count = snapshot?.pinnedWindowCount, count > 0 {
            let unpin = NSMenuItem(title: "Unpin All Windows (\(count))", action: #selector(unpinAll), keyEquivalent: "")
            unpin.target = self
            unpin.image = NSImage(systemSymbolName: "pin.slash", accessibilityDescription: nil)
            menu.addItem(unpin)
            menu.addItem(.separator())
        }
        let about = NSMenuItem(title: "About Jumpee", action: #selector(showAbout), keyEquivalent: "")
        about.target = self
        about.image = NSImage(systemSymbolName: "info.circle", accessibilityDescription: nil)
        menu.addItem(about)
        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Quit Jumpee", action: #selector(quit), keyEquivalent: "q")
        quit.target = self
        quit.image = NSImage(systemSymbolName: "power", accessibilityDescription: nil)
        menu.addItem(quit)
        menu.popUp(positioning: nil, at: NSPoint(x: moreButton.bounds.minX, y: moreButton.bounds.minY - 4), in: moreButton)
    }

    @objc private func unpinAll() { onUnpinAll?() }
    @objc private func showAbout() { onAbout?() }
    @objc private func quit() { onQuit?() }
}

final class WorkspacePopoverController: NSObject, NSPopoverDelegate {
    private let popover = NSPopover()
    private let contentController = WorkspacePopoverContentViewController()
    private let snapshotProvider: () -> WorkspacePopoverSnapshot
    private var cursorAnchorWindow: NSWindow?
    private var previousApplication: NSRunningApplication?
    private var restorePreviousApplication = true
    /// Active space when the popover opened. Focus is handed back to the previous app
    /// only while this is still the active space: re-activating that app after a
    /// desktop switch (e.g. the user pressed ⌃N with the popover open) would make macOS
    /// jump back to the desktop holding its window.
    private var spaceWhenShown: Int?
    private var keyMonitor: Any?
    /// Work to run once the popover has fully closed (after its dismissal animation),
    /// e.g. opening the Move Window destination menu.
    private var afterCloseAction: (() -> Void)?

    init(
        snapshotProvider: @escaping () -> WorkspacePopoverSnapshot,
        navigateHandler: @escaping (Int) -> Void,
        renameHandler: @escaping () -> Void,
        moveWindowHandler: @escaping (NSRunningApplication?) -> Void,
        pinWindowHandler: @escaping () -> Void,
        unpinAllHandler: @escaping () -> Void,
        settingsHandler: @escaping () -> Void,
        aboutHandler: @escaping () -> Void,
        quitHandler: @escaping () -> Void
    ) {
        self.snapshotProvider = snapshotProvider
        super.init()
        popover.behavior = .transient
        popover.animates = true
        popover.contentSize = NSSize(width: 380, height: 590)
        popover.contentViewController = contentController
        popover.delegate = self

        contentController.onNavigate = { [weak self] globalPosition in
            // Re-activating the previous app after a desktop switch makes macOS jump
            // back to the desktop holding that app's window, undoing the switch.
            // Only hand focus back when the user picked the desktop they are already on.
            let isCurrent = snapshotProvider().displays
                .flatMap(\.spaces)
                .contains { $0.globalPosition == globalPosition && $0.isCurrent }
            self?.close(restoreFocus: isCurrent)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { navigateHandler(globalPosition) }
        }
        contentController.onDismiss = { [weak self] in
            self?.close(restoreFocus: true)
        }
        contentController.onRename = { [weak self] in
            self?.close(restoreFocus: false)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { renameHandler() }
        }
        contentController.onMoveWindow = { [weak self] in
            // Capture the app the user was working in before the popover took focus.
            // Do NOT restore focus to it here: the destination menu that follows is a
            // pop-up NSMenu owned by Jumpee, and handing focus back to the other app
            // while it is open dismisses it before the user can pick a desktop.
            // openMoveWindowMenu restores focus to targetApp once the menu closes.
            let targetApp = self?.previousApplication
            self?.afterCloseAction = { moveWindowHandler(targetApp) }
            self?.close(restoreFocus: false)
        }
        contentController.onPinWindow = { [weak self] in
            self?.close(restoreFocus: true)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) { pinWindowHandler() }
        }
        contentController.onUnpinAll = { [weak self] in
            unpinAllHandler()
            self?.refresh()
        }
        contentController.onResetDock = { [weak self] in
            self?.close(restoreFocus: true)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { SpaceNavigator.restartDock() }
        }
        contentController.onSettings = { [weak self] in
            self?.close(restoreFocus: false)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { settingsHandler() }
        }
        contentController.onAbout = { [weak self] in
            self?.close(restoreFocus: false)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { aboutHandler() }
        }
        contentController.onQuit = { [weak self] in
            self?.close(restoreFocus: false)
            quitHandler()
        }
    }

    var isShown: Bool { popover.isShown }

    func toggle(from statusButton: NSStatusBarButton?, atCursor: Bool) {
        if popover.isShown {
            close(restoreFocus: true)
            return
        }
        show(from: statusButton, atCursor: atCursor)
    }

    func refresh() {
        contentController.update(with: snapshotProvider())
    }

    func close(restoreFocus: Bool) {
        restorePreviousApplication = restoreFocus
        popover.performClose(nil)
    }

    private func show(from statusButton: NSStatusBarButton?, atCursor: Bool) {
        previousApplication = NSWorkspace.shared.frontmostApplication
        restorePreviousApplication = true
        spaceWhenShown = CGSGetActiveSpace(CGSMainConnectionID())
        refresh()

        if atCursor || statusButton == nil {
            let point = NSEvent.mouseLocation
            let panel = NSPanel(
                contentRect: NSRect(x: point.x, y: point.y, width: 2, height: 2),
                styleMask: [.borderless],
                backing: .buffered,
                defer: false
            )
            panel.backgroundColor = .clear
            panel.isOpaque = false
            panel.hasShadow = false
            panel.ignoresMouseEvents = true
            panel.level = .popUpMenu
            panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            panel.orderFront(nil)
            cursorAnchorWindow = panel
            if let anchorView = panel.contentView {
                popover.show(relativeTo: anchorView.bounds, of: anchorView, preferredEdge: .maxY)
            }
        } else if let statusButton {
            popover.show(relativeTo: statusButton.bounds, of: statusButton, preferredEdge: .minY)
        }
        NSApp.activate(ignoringOtherApps: true)

        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self else { return event }
            return self.contentController.handleKeyEvent(event) ? nil : event
        }
    }

    func popoverDidClose(_ notification: Notification) {
        if let keyMonitor {
            NSEvent.removeMonitor(keyMonitor)
            self.keyMonitor = nil
        }
        cursorAnchorWindow?.orderOut(nil)
        cursorAnchorWindow = nil
        if restorePreviousApplication,
           let previousApplication,
           previousApplication.bundleIdentifier != Bundle.main.bundleIdentifier {
            // A ⌃N switch may close the popover before the new space registers, so check
            // the space now and once more shortly after.
            let shownSpace = spaceWhenShown
            let stillOnShownSpace = { CGSGetActiveSpace(CGSMainConnectionID()) == shownSpace }
            if stillOnShownSpace() {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    if stillOnShownSpace() { previousApplication.activate() }
                }
            }
        }
        previousApplication = nil
        spaceWhenShown = nil
        restorePreviousApplication = true
        if let afterCloseAction {
            self.afterCloseAction = nil
            DispatchQueue.main.async { afterCloseAction() }
        }
    }
}
