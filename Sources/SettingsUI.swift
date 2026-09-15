import Cocoa

// MARK: - Shared Settings UI Helpers

enum JumpeeUI {
    static func symbol(_ name: String, description: String) -> NSImage? {
        NSImage(systemSymbolName: name, accessibilityDescription: description)
    }

    static func verticalStack(spacing: CGFloat = 12) -> NSStackView {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.distribution = .fill
        stack.spacing = spacing
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }

    static func section(title: String, rows: [NSView]) -> NSBox {
        let box = NSBox()
        box.title = title
        box.titlePosition = .atTop
        box.boxType = .primary
        box.translatesAutoresizingMaskIntoConstraints = false

        let stack = verticalStack(spacing: 0)
        for row in rows {
            stack.addArrangedSubview(row)
            row.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        }
        guard let content = box.contentView else { return box }
        content.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 10),
            stack.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -10),
            stack.topAnchor.constraint(equalTo: content.topAnchor, constant: 8),
            stack.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -8),
        ])
        return box
    }

    static func settingRow(
        title: String,
        subtitle: String? = nil,
        control: NSView
    ) -> NSView {
        let row = NSView()
        row.translatesAutoresizingMaskIntoConstraints = false
        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = .systemFont(ofSize: 13)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        let labels = verticalStack(spacing: 1)
        labels.addArrangedSubview(titleLabel)
        if let subtitle {
            let subtitleLabel = NSTextField(labelWithString: subtitle)
            subtitleLabel.font = .systemFont(ofSize: 11)
            subtitleLabel.textColor = .secondaryLabelColor
            subtitleLabel.lineBreakMode = .byTruncatingTail
            labels.addArrangedSubview(subtitleLabel)
        }

        control.translatesAutoresizingMaskIntoConstraints = false
        row.addSubview(labels)
        row.addSubview(control)
        NSLayoutConstraint.activate([
            row.heightAnchor.constraint(greaterThanOrEqualToConstant: subtitle == nil ? 38 : 50),
            labels.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 2),
            labels.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            control.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -2),
            control.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            labels.trailingAnchor.constraint(lessThanOrEqualTo: control.leadingAnchor, constant: -16),
        ])
        return row
    }

    static func formRow(label: String, control: NSView, valueLabel: NSTextField? = nil) -> NSView {
        let row = NSView()
        row.translatesAutoresizingMaskIntoConstraints = false
        let labelField = NSTextField(labelWithString: label)
        labelField.alignment = .right
        labelField.translatesAutoresizingMaskIntoConstraints = false
        control.translatesAutoresizingMaskIntoConstraints = false
        row.addSubview(labelField)
        row.addSubview(control)

        var constraints = [
            row.heightAnchor.constraint(greaterThanOrEqualToConstant: 32),
            labelField.leadingAnchor.constraint(equalTo: row.leadingAnchor),
            labelField.widthAnchor.constraint(equalToConstant: 105),
            labelField.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            control.leadingAnchor.constraint(equalTo: labelField.trailingAnchor, constant: 10),
            control.centerYAnchor.constraint(equalTo: row.centerYAnchor),
        ]
        if let valueLabel {
            valueLabel.translatesAutoresizingMaskIntoConstraints = false
            row.addSubview(valueLabel)
            constraints += [
                valueLabel.leadingAnchor.constraint(equalTo: control.trailingAnchor, constant: 10),
                valueLabel.trailingAnchor.constraint(lessThanOrEqualTo: row.trailingAnchor),
                valueLabel.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            ]
        } else {
            constraints.append(control.trailingAnchor.constraint(lessThanOrEqualTo: row.trailingAnchor))
        }
        NSLayoutConstraint.activate(constraints)
        return row
    }

    static func numericField(min: Double, max: Double) -> NSTextField {
        let field = NSTextField()
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimum = NSNumber(value: min)
        formatter.maximum = NSNumber(value: max)
        formatter.allowsFloats = true
        field.formatter = formatter
        field.alignment = .right
        field.widthAnchor.constraint(equalToConstant: 80).isActive = true
        return field
    }

    static func showWarning(title: String, message: String, window: NSWindow?) {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        if let window {
            alert.beginSheetModal(for: window)
        } else {
            alert.runModal()
        }
    }
}

protocol JumpeeSettingsPane: AnyObject {
    func reloadFromConfig()
}

final class JumpeeTabViewController: NSTabViewController {
    var selectionChanged: ((Int) -> Void)?

    override func tabView(_ tabView: NSTabView, didSelect tabViewItem: NSTabViewItem?) {
        super.tabView(tabView, didSelect: tabViewItem)
        selectionChanged?(selectedTabViewItemIndex)
    }
}

// MARK: - Settings Window

final class JumpeeSettingsWindowController: NSWindowController {
    typealias ConfigProvider = () -> JumpeeConfig
    typealias ConfigUpdater = (JumpeeConfig) -> Void

    private let panes: [JumpeeSettingsPane]

    init(
        configProvider: @escaping ConfigProvider,
        configUpdater: @escaping ConfigUpdater,
        reloadHandler: @escaping () -> Void,
        recordingChanged: @escaping (Bool) -> Void,
        aboutHandler: @escaping () -> Void,
        quitHandler: @escaping () -> Void
    ) {
        let general = GeneralSettingsViewController(
            configProvider: configProvider,
            configUpdater: configUpdater
        )
        let appearance = AppearanceSettingsViewController(
            configProvider: configProvider,
            configUpdater: configUpdater
        )
        let shortcuts = ShortcutsSettingsViewController(
            configProvider: configProvider,
            configUpdater: configUpdater,
            recordingChanged: recordingChanged
        )
        let advanced = AdvancedSettingsViewController(
            configProvider: configProvider,
            reloadHandler: reloadHandler,
            aboutHandler: aboutHandler,
            quitHandler: quitHandler
        )
        self.panes = [general, appearance, shortcuts, advanced]

        let tabs = JumpeeTabViewController()
        tabs.tabStyle = .toolbar
        let definitions: [(NSViewController, String, String)] = [
            (general, "General", "gearshape"),
            (appearance, "Appearance", "paintbrush"),
            (shortcuts, "Shortcuts", "keyboard"),
            (advanced, "Advanced", "slider.horizontal.3"),
        ]
        for (controller, label, symbolName) in definitions {
            let item = NSTabViewItem(viewController: controller)
            item.label = label
            item.image = JumpeeUI.symbol(symbolName, description: label)
            tabs.addTabViewItem(item)
        }

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 650, height: 520),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "General"
        window.contentViewController = tabs
        window.isReleasedWhenClosed = false
        window.titlebarAppearsTransparent = false
        window.toolbarStyle = .preference
        window.center()
        super.init(window: window)

        let paneTitles = ["General", "Appearance", "Shortcuts", "Advanced"]
        let paneSizes = [
            NSSize(width: 650, height: 520),
            NSSize(width: 650, height: 735),
            NSSize(width: 650, height: 540),
            NSSize(width: 650, height: 570),
        ]
        tabs.selectionChanged = { [weak window] index in
            guard let window, paneTitles.indices.contains(index) else { return }
            window.title = paneTitles[index]
            let oldFrame = window.frame
            let contentRect = NSRect(origin: .zero, size: paneSizes[index])
            let newSize = window.frameRect(forContentRect: contentRect).size
            let newFrame = NSRect(
                x: oldFrame.midX - newSize.width / 2,
                y: oldFrame.maxY - newSize.height,
                width: newSize.width,
                height: newSize.height
            )
            window.setFrame(newFrame, display: true, animate: true)
        }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func showSettings() {
        panes.forEach { $0.reloadFromConfig() }
        NSApp.activate(ignoringOtherApps: true)
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
    }
}

// MARK: - General Pane

final class GeneralSettingsViewController: NSViewController, JumpeeSettingsPane {
    private let configProvider: () -> JumpeeConfig
    private let configUpdater: (JumpeeConfig) -> Void
    private let showNumberSwitch = NSSwitch()
    private let showMenuBarSwitch = NSSwitch()
    private let dropdownLocation = NSSegmentedControl(labels: ["Menu Bar", "Pointer"], trackingMode: .selectOne, target: nil, action: nil)
    private let overlaySwitch = NSSwitch()
    private let inputSourceSwitch = NSSwitch()
    private let moveWindowSwitch = NSSwitch()
    private let pinWindowSwitch = NSSwitch()

    init(configProvider: @escaping () -> JumpeeConfig, configUpdater: @escaping (JumpeeConfig) -> Void) {
        self.configProvider = configProvider
        self.configUpdater = configUpdater
        super.init(nibName: nil, bundle: nil)
        self.title = "General"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        for control in [showNumberSwitch, showMenuBarSwitch, overlaySwitch, inputSourceSwitch, moveWindowSwitch, pinWindowSwitch] {
            control.target = self
            control.action = #selector(controlChanged)
        }
        dropdownLocation.target = self
        dropdownLocation.action = #selector(controlChanged)
        dropdownLocation.segmentStyle = .rounded

        let menuSection = JumpeeUI.section(title: "Menu Bar", rows: [
            JumpeeUI.settingRow(title: "Show desktop number", control: showNumberSwitch),
            JumpeeUI.settingRow(title: "Show Jumpee in the menu bar", control: showMenuBarSwitch),
        ])
        let dropdownSection = JumpeeUI.section(title: "Dropdown", rows: [
            JumpeeUI.settingRow(
                title: "Open the desktop list at",
                subtitle: "The global shortcut can follow the pointer or use the menu-bar item.",
                control: dropdownLocation
            ),
        ])
        let featuresSection = JumpeeUI.section(title: "Features", rows: [
            JumpeeUI.settingRow(title: "Desktop overlay", control: overlaySwitch),
            JumpeeUI.settingRow(title: "Input source indicator", control: inputSourceSwitch),
            JumpeeUI.settingRow(title: "Move windows between desktops", control: moveWindowSwitch),
            JumpeeUI.settingRow(title: "Pin windows on top", control: pinWindowSwitch),
        ])

        let stack = JumpeeUI.verticalStack(spacing: 14)
        stack.addArrangedSubview(menuSection)
        stack.addArrangedSubview(dropdownSection)
        stack.addArrangedSubview(featuresSection)
        for section in [menuSection, dropdownSection, featuresSection] {
            section.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        }
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            view.widthAnchor.constraint(greaterThanOrEqualToConstant: 620),
            view.heightAnchor.constraint(greaterThanOrEqualToConstant: 430),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 22),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -22),
        ])
        reloadFromConfig()
    }

    func reloadFromConfig() {
        guard isViewLoaded else { return }
        let config = configProvider()
        showNumberSwitch.state = config.showSpaceNumber ? .on : .off
        showMenuBarSwitch.state = config.effectiveMenuBarVisible ? .on : .off
        dropdownLocation.selectedSegment = config.effectiveDropdownAtCursor ? 1 : 0
        overlaySwitch.state = config.overlay.enabled ? .on : .off
        inputSourceSwitch.state = config.inputSourceIndicator?.enabled == true ? .on : .off
        moveWindowSwitch.state = config.moveWindow?.enabled == true ? .on : .off
        pinWindowSwitch.state = config.pinWindow?.enabled == true ? .on : .off
    }

    @objc private func controlChanged() {
        var config = configProvider()
        config.showSpaceNumber = showNumberSwitch.state == .on
        config.menuBarVisible = showMenuBarSwitch.state == .on
        config.dropdownAtCursor = dropdownLocation.selectedSegment == 1
        config.overlay.enabled = overlaySwitch.state == .on
        if config.inputSourceIndicator == nil {
            config.inputSourceIndicator = InputSourceIndicatorConfig(enabled: inputSourceSwitch.state == .on)
        } else {
            config.inputSourceIndicator?.enabled = inputSourceSwitch.state == .on
        }
        config.moveWindow = MoveWindowConfig(enabled: moveWindowSwitch.state == .on)
        config.pinWindow = PinWindowConfig(enabled: pinWindowSwitch.state == .on)
        configUpdater(config)
    }
}

// MARK: - Appearance Pane

final class AppearancePreviewView: NSView {
    var config: JumpeeConfig? { didSet { needsDisplay = true } }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let bounds = self.bounds.insetBy(dx: 1, dy: 1)
        let path = NSBezierPath(roundedRect: bounds, xRadius: 8, yRadius: 8)
        NSGradient(colors: [
            NSColor(calibratedRed: 0.71, green: 0.84, blue: 0.96, alpha: 1),
            NSColor(calibratedRed: 0.90, green: 0.76, blue: 0.72, alpha: 1),
        ])?.draw(in: path, angle: 20)

        let menuBarRect = NSRect(x: bounds.minX, y: bounds.maxY - 22, width: bounds.width, height: 22)
        NSColor.windowBackgroundColor.withAlphaComponent(0.82).setFill()
        NSBezierPath(roundedRect: menuBarRect, xRadius: 7, yRadius: 7).fill()

        guard let config else { return }
        let overlayName = config.showSpaceNumber ? "1: AI Hub Registry" : "AI Hub Registry"
        let overlayColor = NSColor.fromHex(config.overlay.textColor)
            .withAlphaComponent(CGFloat(config.overlay.opacity))
        let overlayFont = NSFont.systemFont(ofSize: 27, weight: fontWeight(from: config.overlay.fontWeight))
        let overlayAttributes: [NSAttributedString.Key: Any] = [
            .font: overlayFont,
            .foregroundColor: overlayColor,
        ]
        let overlaySize = overlayName.size(withAttributes: overlayAttributes)
        overlayName.draw(
            at: NSPoint(x: bounds.midX - overlaySize.width / 2, y: bounds.midY - 8),
            withAttributes: overlayAttributes
        )

        if let indicator = config.inputSourceIndicator, indicator.enabled {
            let label = indicator.effectiveDisplayText(for: "U.S.")
            let attributes: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 12, weight: .semibold),
                .foregroundColor: NSColor.fromHex(indicator.effectiveTextColor(for: "U.S.")),
            ]
            let size = label.size(withAttributes: attributes)
            let pill = NSRect(
                x: bounds.midX - size.width / 2 - 9,
                y: menuBarRect.minY - 28,
                width: size.width + 18,
                height: 22
            )
            NSColor.fromHex(indicator.effectiveBackgroundColor)
                .withAlphaComponent(CGFloat(indicator.effectiveBackgroundOpacity)).setFill()
            NSBezierPath(roundedRect: pill, xRadius: 6, yRadius: 6).fill()
            label.draw(at: NSPoint(x: pill.midX - size.width / 2, y: pill.midY - size.height / 2), withAttributes: attributes)
        }
    }
}

final class AppearanceSettingsViewController: NSViewController, JumpeeSettingsPane, NSTextFieldDelegate, NSComboBoxDelegate {
    private let configProvider: () -> JumpeeConfig
    private let configUpdater: (JumpeeConfig) -> Void
    private let positionPopup = NSPopUpButton()
    private let fontCombo = NSComboBox()
    private let overlaySizeField = JumpeeUI.numericField(min: 10, max: 240)
    private let overlayColorWell = NSColorWell()
    private let opacitySlider = NSSlider(value: 15, minValue: 0, maxValue: 100, target: nil, action: nil)
    private let opacityValue = NSTextField(labelWithString: "15%")
    private let marginField = JumpeeUI.numericField(min: 0, max: 500)
    private let inputSizeField = JumpeeUI.numericField(min: 10, max: 160)
    private let inputTextColorWell = NSColorWell()
    private let inputBackgroundColorWell = NSColorWell()
    private let inputBackgroundOpacitySlider = NSSlider(value: 30, minValue: 0, maxValue: 100, target: nil, action: nil)
    private let inputBackgroundOpacityValue = NSTextField(labelWithString: "30%")
    private let preview = AppearancePreviewView()

    init(configProvider: @escaping () -> JumpeeConfig, configUpdater: @escaping (JumpeeConfig) -> Void) {
        self.configProvider = configProvider
        self.configUpdater = configUpdater
        super.init(nibName: nil, bundle: nil)
        self.title = "Appearance"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false

        positionPopup.addItems(withTitles: [
            "Top Left", "Top Center", "Top Right", "Center",
            "Bottom Left", "Bottom Center", "Bottom Right",
        ])
        positionPopup.target = self
        positionPopup.action = #selector(controlChanged)
        positionPopup.widthAnchor.constraint(equalToConstant: 190).isActive = true

        fontCombo.addItems(withObjectValues: NSFontManager.shared.availableFontFamilies)
        fontCombo.isEditable = true
        fontCombo.completes = true
        fontCombo.delegate = self
        fontCombo.target = self
        fontCombo.action = #selector(controlChanged)
        fontCombo.widthAnchor.constraint(equalToConstant: 190).isActive = true

        for field in [overlaySizeField, marginField, inputSizeField] {
            field.delegate = self
            field.target = self
            field.action = #selector(controlChanged)
        }
        for well in [overlayColorWell, inputTextColorWell, inputBackgroundColorWell] {
            well.target = self
            well.action = #selector(controlChanged)
        }
        opacitySlider.target = self
        opacitySlider.action = #selector(controlChanged)
        opacitySlider.isContinuous = true
        opacitySlider.widthAnchor.constraint(equalToConstant: 255).isActive = true
        inputBackgroundOpacitySlider.target = self
        inputBackgroundOpacitySlider.action = #selector(controlChanged)
        inputBackgroundOpacitySlider.isContinuous = true
        inputBackgroundOpacitySlider.widthAnchor.constraint(equalToConstant: 255).isActive = true

        let overlaySection = JumpeeUI.section(title: "Desktop Overlay", rows: [
            JumpeeUI.formRow(label: "Position:", control: positionPopup),
            JumpeeUI.formRow(label: "Font:", control: fontCombo),
            JumpeeUI.formRow(label: "Size:", control: overlaySizeField),
            JumpeeUI.formRow(label: "Color:", control: overlayColorWell),
            JumpeeUI.formRow(label: "Opacity:", control: opacitySlider, valueLabel: opacityValue),
            JumpeeUI.formRow(label: "Margin:", control: marginField),
        ])
        let inputSection = JumpeeUI.section(title: "Input Source Indicator", rows: [
            JumpeeUI.formRow(label: "Label size:", control: inputSizeField),
            JumpeeUI.formRow(label: "Text color:", control: inputTextColorWell),
            JumpeeUI.formRow(label: "Background:", control: inputBackgroundColorWell),
            JumpeeUI.formRow(label: "Opacity:", control: inputBackgroundOpacitySlider, valueLabel: inputBackgroundOpacityValue),
        ])
        let previewSection = JumpeeUI.section(title: "Preview", rows: [preview])
        preview.translatesAutoresizingMaskIntoConstraints = false
        preview.heightAnchor.constraint(equalToConstant: 120).isActive = true

        let restoreButton = NSButton(title: "Restore Defaults", target: self, action: #selector(restoreDefaults))
        let stack = JumpeeUI.verticalStack(spacing: 12)
        for section in [overlaySection, inputSection, previewSection] {
            stack.addArrangedSubview(section)
            section.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        }
        stack.addArrangedSubview(restoreButton)
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            view.widthAnchor.constraint(greaterThanOrEqualToConstant: 620),
            view.heightAnchor.constraint(greaterThanOrEqualToConstant: 650),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -20),
        ])
        reloadFromConfig()
    }

    func reloadFromConfig() {
        guard isViewLoaded else { return }
        let config = configProvider()
        let positionTitle = config.overlay.position
            .split(separator: "-")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
        positionPopup.selectItem(withTitle: positionTitle)
        fontCombo.stringValue = config.overlay.fontName
        overlaySizeField.doubleValue = config.overlay.fontSize
        overlayColorWell.color = NSColor.fromHex(config.overlay.textColor)
        opacitySlider.doubleValue = config.overlay.opacity * 100
        opacityValue.stringValue = "\(Int(round(opacitySlider.doubleValue)))%"
        marginField.doubleValue = config.overlay.margin

        let indicator = config.inputSourceIndicator ?? InputSourceIndicatorConfig(enabled: false)
        inputSizeField.doubleValue = indicator.effectiveFontSize
        inputTextColorWell.color = NSColor.fromHex(indicator.effectiveTextColor)
        inputBackgroundColorWell.color = NSColor.fromHex(indicator.effectiveBackgroundColor)
        inputBackgroundOpacitySlider.doubleValue = indicator.effectiveBackgroundOpacity * 100
        inputBackgroundOpacityValue.stringValue = "\(Int(round(inputBackgroundOpacitySlider.doubleValue)))%"
        preview.config = config
    }

    func controlTextDidEndEditing(_ obj: Notification) {
        controlChanged()
    }

    func comboBoxSelectionDidChange(_ notification: Notification) {
        controlChanged()
    }

    @objc private func controlChanged() {
        var config = configProvider()
        config.overlay.position = (positionPopup.titleOfSelectedItem ?? "Top Center")
            .lowercased().replacingOccurrences(of: " ", with: "-")
        config.overlay.fontName = fontCombo.stringValue.isEmpty ? config.overlay.fontName : fontCombo.stringValue
        config.overlay.fontSize = overlaySizeField.doubleValue
        config.overlay.textColor = overlayColorWell.color.hexString
        config.overlay.opacity = opacitySlider.doubleValue / 100
        config.overlay.margin = marginField.doubleValue

        var indicator = config.inputSourceIndicator ?? InputSourceIndicatorConfig(enabled: false)
        indicator.fontSize = inputSizeField.doubleValue
        indicator.textColor = inputTextColorWell.color.hexString
        indicator.backgroundColor = inputBackgroundColorWell.color.hexString
        indicator.backgroundOpacity = inputBackgroundOpacitySlider.doubleValue / 100
        config.inputSourceIndicator = indicator

        opacityValue.stringValue = "\(Int(round(opacitySlider.doubleValue)))%"
        inputBackgroundOpacityValue.stringValue = "\(Int(round(inputBackgroundOpacitySlider.doubleValue)))%"
        preview.config = config
        configUpdater(config)
    }

    @objc private func restoreDefaults() {
        var config = configProvider()
        let wasEnabled = config.overlay.enabled
        config.overlay = OverlayConfig.defaultConfig
        config.overlay.enabled = wasEnabled
        if var indicator = config.inputSourceIndicator {
            let enabled = indicator.enabled
            let labels = indicator.languageLabels
            let colors = indicator.languageColors
            indicator = InputSourceIndicatorConfig(enabled: enabled)
            indicator.languageLabels = labels
            indicator.languageColors = colors
            config.inputSourceIndicator = indicator
        }
        configUpdater(config)
        reloadFromConfig()
    }
}

// MARK: - Shortcut Recorder and Pane

final class ShortcutRecorderButton: NSButton {
    var shortcut: HotkeyConfig = .defaultConfig { didSet { updateTitle() } }
    var recordingChanged: ((Bool) -> Void)?
    var shortcutChanged: ((HotkeyConfig) -> Bool)?
    private var isRecordingShortcut = false

    override var acceptsFirstResponder: Bool { true }

    convenience init() {
        self.init(frame: .zero)
        bezelStyle = .rounded
        target = self
        action = #selector(beginRecording)
        widthAnchor.constraint(equalToConstant: 150).isActive = true
        updateTitle()
    }

    @objc private func beginRecording() {
        isRecordingShortcut = true
        title = "Type Shortcut…"
        recordingChanged?(true)
        window?.makeFirstResponder(self)
    }

    override func keyDown(with event: NSEvent) {
        guard isRecordingShortcut else {
            super.keyDown(with: event)
            return
        }
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        if event.keyCode == 53 && flags.intersection([.command, .control, .option, .shift]).isEmpty {
            finishRecording()
            return
        }
        guard let key = HotkeyConfig.key(for: CGKeyCode(event.keyCode)) else {
            NSSound.beep()
            return
        }
        var modifiers: [String] = []
        if flags.contains(.control) { modifiers.append("control") }
        if flags.contains(.option) { modifiers.append("option") }
        if flags.contains(.shift) { modifiers.append("shift") }
        if flags.contains(.command) { modifiers.append("command") }
        guard !modifiers.isEmpty else {
            NSSound.beep()
            return
        }

        let candidate = HotkeyConfig(key: key, modifiers: modifiers)
        if shortcutChanged?(candidate) == true {
            shortcut = candidate
        }
        finishRecording()
    }

    override func resignFirstResponder() -> Bool {
        if isRecordingShortcut { finishRecording() }
        return super.resignFirstResponder()
    }

    private func finishRecording() {
        guard isRecordingShortcut else { return }
        isRecordingShortcut = false
        recordingChanged?(false)
        updateTitle()
    }

    private func updateTitle() {
        guard !isRecordingShortcut else { return }
        title = shortcut.displayString
        toolTip = "Click, then type a shortcut"
    }
}

final class ShortcutsSettingsViewController: NSViewController, JumpeeSettingsPane {
    private let configProvider: () -> JumpeeConfig
    private let configUpdater: (JumpeeConfig) -> Void
    private let recordingChanged: (Bool) -> Void
    private let dropdownRecorder = ShortcutRecorderButton()
    private let moveRecorder = ShortcutRecorderButton()
    private let pinRecorder = ShortcutRecorderButton()

    init(
        configProvider: @escaping () -> JumpeeConfig,
        configUpdater: @escaping (JumpeeConfig) -> Void,
        recordingChanged: @escaping (Bool) -> Void
    ) {
        self.configProvider = configProvider
        self.configUpdater = configUpdater
        self.recordingChanged = recordingChanged
        super.init(nibName: nil, bundle: nil)
        self.title = "Shortcuts"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        configureRecorder(dropdownRecorder, slot: .dropdown)
        configureRecorder(moveRecorder, slot: .moveWindow)
        configureRecorder(pinRecorder, slot: .pinWindow)

        let globalSection = JumpeeUI.section(title: "Global Shortcuts", rows: [
            shortcutRow(title: "Open Jumpee", subtitle: "Show the desktop list from anywhere", recorder: dropdownRecorder, slot: .dropdown),
            shortcutRow(title: "Move Current Window", subtitle: "Choose a destination desktop", recorder: moveRecorder, slot: .moveWindow),
            shortcutRow(title: "Pin or Unpin Window", subtitle: "Keep the focused window above others", recorder: pinRecorder, slot: .pinWindow),
        ])
        let desktopShortcuts = NSTextField(labelWithString: "⌘1 … ⌘9")
        desktopShortcuts.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        let renameShortcut = NSTextField(labelWithString: "⌘N")
        renameShortcut.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        let menuSection = JumpeeUI.section(title: "Menu Shortcuts", rows: [
            JumpeeUI.settingRow(title: "Switch to Desktop 1–9", control: desktopShortcuts),
            JumpeeUI.settingRow(title: "Rename Current Desktop", control: renameShortcut),
        ])
        let note = NSTextField(wrappingLabelWithString: "Jumpee warns you if a shortcut conflicts with another Jumpee action. Press Escape while recording to cancel.")
        note.textColor = .secondaryLabelColor
        note.font = .systemFont(ofSize: 11)
        let restore = NSButton(title: "Restore Defaults", target: self, action: #selector(restoreDefaults))

        let stack = JumpeeUI.verticalStack(spacing: 14)
        for section in [globalSection, menuSection] {
            stack.addArrangedSubview(section)
            section.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        }
        stack.addArrangedSubview(note)
        note.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        stack.addArrangedSubview(restore)
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            view.widthAnchor.constraint(greaterThanOrEqualToConstant: 620),
            view.heightAnchor.constraint(greaterThanOrEqualToConstant: 430),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 22),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -22),
        ])
        reloadFromConfig()
    }

    private func configureRecorder(_ recorder: ShortcutRecorderButton, slot: HotkeySlot) {
        recorder.recordingChanged = recordingChanged
        recorder.shortcutChanged = { [weak self] candidate in
            self?.setShortcut(candidate, for: slot) ?? false
        }
    }

    private func shortcutRow(
        title: String,
        subtitle: String,
        recorder: ShortcutRecorderButton,
        slot: HotkeySlot
    ) -> NSView {
        let reset = NSButton(
            image: JumpeeUI.symbol("arrow.counterclockwise", description: "Reset") ?? NSImage(),
            target: self,
            action: #selector(resetShortcut(_:))
        )
        reset.bezelStyle = .rounded
        reset.tag = tag(for: slot)
        reset.toolTip = "Reset \(title)"
        let controls = NSStackView(views: [recorder, reset])
        controls.orientation = .horizontal
        controls.spacing = 8
        return JumpeeUI.settingRow(title: title, subtitle: subtitle, control: controls)
    }

    func reloadFromConfig() {
        guard isViewLoaded else { return }
        let config = configProvider()
        dropdownRecorder.shortcut = config.hotkey
        moveRecorder.shortcut = config.effectiveMoveWindowHotkey
        pinRecorder.shortcut = config.effectivePinWindowHotkey
        moveRecorder.isEnabled = config.moveWindow?.enabled == true
        pinRecorder.isEnabled = config.pinWindow?.enabled == true
    }

    private func setShortcut(_ shortcut: HotkeyConfig, for slot: HotkeySlot) -> Bool {
        var config = configProvider()
        let active: [(HotkeySlot, String, HotkeyConfig)] = [
            (.dropdown, "Open Jumpee", config.hotkey),
            (.moveWindow, "Move Current Window", config.effectiveMoveWindowHotkey),
            (.pinWindow, "Pin or Unpin Window", config.effectivePinWindowHotkey),
        ]
        for (otherSlot, name, other) in active where otherSlot != slot {
            if shortcut.key.lowercased() == other.key.lowercased()
                && Set(shortcut.modifiers.map { $0.lowercased() }) == Set(other.modifiers.map { $0.lowercased() }) {
                JumpeeUI.showWarning(
                    title: "Shortcut Already In Use",
                    message: "That shortcut is already assigned to \(name).",
                    window: view.window
                )
                return false
            }
        }
        switch slot {
        case .dropdown: config.hotkey = shortcut
        case .moveWindow: config.moveWindowHotkey = shortcut
        case .pinWindow: config.pinWindowHotkey = shortcut
        }
        configUpdater(config)
        return true
    }

    @objc private func resetShortcut(_ sender: NSButton) {
        guard let slot = slot(for: sender.tag) else { return }
        let value: HotkeyConfig
        switch slot {
        case .dropdown: value = .defaultConfig
        case .moveWindow: value = HotkeyConfig(key: "m", modifiers: ["command"])
        case .pinWindow: value = HotkeyConfig(key: "p", modifiers: ["control", "command"])
        }
        _ = setShortcut(value, for: slot)
        reloadFromConfig()
    }

    @objc private func restoreDefaults() {
        var config = configProvider()
        config.hotkey = .defaultConfig
        config.moveWindowHotkey = HotkeyConfig(key: "m", modifiers: ["command"])
        config.pinWindowHotkey = HotkeyConfig(key: "p", modifiers: ["control", "command"])
        configUpdater(config)
        reloadFromConfig()
    }

    private func tag(for slot: HotkeySlot) -> Int {
        switch slot { case .dropdown: return 1; case .moveWindow: return 2; case .pinWindow: return 3 }
    }

    private func slot(for tag: Int) -> HotkeySlot? {
        switch tag { case 1: return .dropdown; case 2: return .moveWindow; case 3: return .pinWindow; default: return nil }
    }
}

// MARK: - Advanced Pane

final class AdvancedSettingsViewController: NSViewController, JumpeeSettingsPane {
    private let configProvider: () -> JumpeeConfig
    private let reloadHandler: () -> Void
    private let aboutHandler: () -> Void
    private let quitHandler: () -> Void
    private let accessibilityStatus = NSTextField(labelWithString: "")
    private let shortcutsStatus = NSTextField(labelWithString: "")
    private let recordingStatus = NSTextField(labelWithString: "")

    init(
        configProvider: @escaping () -> JumpeeConfig,
        reloadHandler: @escaping () -> Void,
        aboutHandler: @escaping () -> Void,
        quitHandler: @escaping () -> Void
    ) {
        self.configProvider = configProvider
        self.reloadHandler = reloadHandler
        self.aboutHandler = aboutHandler
        self.quitHandler = quitHandler
        super.init(nibName: nil, bundle: nil)
        self.title = "Advanced"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
        for label in [accessibilityStatus, shortcutsStatus, recordingStatus] {
            label.font = .systemFont(ofSize: 12)
            label.alignment = .right
        }

        let accessibilityButton = NSButton(title: "Open System Settings…", target: self, action: #selector(openAccessibilitySettings))
        let shortcutsButton = NSButton(title: "Review Shortcuts…", target: self, action: #selector(openKeyboardSettings))
        let recordingButton = NSButton(title: "Grant Access…", target: self, action: #selector(requestScreenRecording))
        let systemSection = JumpeeUI.section(title: "System Setup", rows: [
            statusRow(title: "Accessibility", status: accessibilityStatus, button: accessibilityButton),
            statusRow(title: "Mission Control Shortcuts", status: shortcutsStatus, button: shortcutsButton),
            statusRow(title: "Screen Recording", status: recordingStatus, button: recordingButton),
        ])

        let path = NSTextField(labelWithString: "~/.tool-agents/jumpee/config.json")
        path.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        path.lineBreakMode = .byTruncatingMiddle
        let pathRow = JumpeeUI.settingRow(title: "Configuration file", control: path)
        let revealButton = NSButton(title: "Reveal in Finder", target: self, action: #selector(revealConfig))
        let reloadButton = NSButton(title: "Reload Now", target: self, action: #selector(reloadConfig))
        let actions = NSStackView(views: [revealButton, reloadButton])
        actions.orientation = .horizontal
        actions.spacing = 8
        let note = NSTextField(wrappingLabelWithString: "Changes made outside Jumpee take effect after reloading.")
        note.textColor = .secondaryLabelColor
        note.font = .systemFont(ofSize: 11)
        let configSection = JumpeeUI.section(title: "Configuration File", rows: [
            pathRow,
            JumpeeUI.settingRow(title: "File actions", control: actions),
            note,
        ])

        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "dev"
        let aboutButton = NSButton(title: "About Jumpee…", target: self, action: #selector(showAbout))
        let applicationSection = JumpeeUI.section(title: "Application", rows: [
            JumpeeUI.settingRow(title: "Jumpee \(version)", subtitle: "Native desktop navigation utility", control: aboutButton),
        ])
        let quitButton = NSButton(title: "Quit Jumpee", target: self, action: #selector(quit))

        let stack = JumpeeUI.verticalStack(spacing: 14)
        for section in [systemSection, configSection, applicationSection] {
            stack.addArrangedSubview(section)
            section.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        }
        stack.addArrangedSubview(quitButton)
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            view.widthAnchor.constraint(greaterThanOrEqualToConstant: 620),
            view.heightAnchor.constraint(greaterThanOrEqualToConstant: 480),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 22),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -22),
        ])
        reloadFromConfig()
    }

    private func statusRow(title: String, status: NSTextField, button: NSButton) -> NSView {
        let controls = NSStackView(views: [status, button])
        controls.orientation = .horizontal
        controls.spacing = 10
        status.widthAnchor.constraint(equalToConstant: 150).isActive = true
        return JumpeeUI.settingRow(title: title, control: controls)
    }

    func reloadFromConfig() {
        guard isViewLoaded else { return }
        _ = configProvider()
        setStatus(accessibilityStatus, granted: AXIsProcessTrusted(), grantedText: "Granted", missingText: "Not granted")
        setStatus(shortcutsStatus, granted: WindowMover.areSystemShortcutsEnabled(), grantedText: "Detected", missingText: "Not detected")
        setStatus(recordingStatus, granted: CGPreflightScreenCaptureAccess(), grantedText: "Granted", missingText: "Not granted")
    }

    private func setStatus(_ label: NSTextField, granted: Bool, grantedText: String, missingText: String) {
        label.stringValue = granted ? "●  \(grantedText)" : "●  \(missingText)"
        label.textColor = granted ? .systemGreen : .systemOrange
    }

    @objc private func openAccessibilitySettings() {
        openSystemSettings("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
    }

    @objc private func openKeyboardSettings() {
        openSystemSettings("x-apple.systempreferences:com.apple.preference.keyboard?Shortcuts")
    }

    @objc private func requestScreenRecording() {
        _ = CGRequestScreenCaptureAccess()
        reloadFromConfig()
    }

    private func openSystemSettings(_ string: String) {
        if let url = URL(string: string) { NSWorkspace.shared.open(url) }
    }

    @objc private func revealConfig() {
        if !FileManager.default.fileExists(atPath: JumpeeConfig.configFile.path) {
            configProvider().save()
        }
        NSWorkspace.shared.activateFileViewerSelecting([JumpeeConfig.configFile])
    }

    @objc private func reloadConfig() {
        reloadHandler()
        reloadFromConfig()
    }

    @objc private func showAbout() { aboutHandler() }
    @objc private func quit() { quitHandler() }
}
