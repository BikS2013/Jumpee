import Cocoa

enum RenameDesktopResult {
    case rename(String)
    case removeName
    case cancel
}

final class RenameDesktopPanelController: NSObject {
    private let panel: NSPanel
    private let nameField = NSTextField()
    private var result: RenameDesktopResult = .cancel

    init(desktopNumber: Int, currentName: String) {
        panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 430, height: 220),
            styleMask: [.titled],
            backing: .buffered,
            defer: false
        )
        super.init()
        panel.title = "Rename Desktop \(desktopNumber)"
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.isReleasedWhenClosed = false
        panel.level = .floating

        let icon = NSImageView(image: NSImage(systemSymbolName: "display", accessibilityDescription: "Desktop") ?? NSImage())
        icon.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 38, weight: .regular)
        icon.contentTintColor = .secondaryLabelColor
        icon.translatesAutoresizingMaskIntoConstraints = false

        let title = NSTextField(labelWithString: "Rename Desktop \(desktopNumber)")
        title.font = .systemFont(ofSize: 17, weight: .semibold)
        let subtitle = NSTextField(wrappingLabelWithString: "Give this desktop a name that is easy to recognize.")
        subtitle.textColor = .secondaryLabelColor

        nameField.stringValue = currentName
        nameField.placeholderString = "Desktop name"
        nameField.translatesAutoresizingMaskIntoConstraints = false

        let hint = NSTextField(labelWithString: "Press Return to rename")
        hint.font = .systemFont(ofSize: 11)
        hint.textColor = .tertiaryLabelColor

        let removeButton = NSButton(title: "Remove Name", target: self, action: #selector(removeName))
        removeButton.isBordered = false
        removeButton.contentTintColor = .systemRed
        let cancelButton = NSButton(title: "Cancel", target: self, action: #selector(cancel))
        cancelButton.keyEquivalent = "\u{1b}"
        let renameButton = NSButton(title: "Rename", target: self, action: #selector(rename))
        renameButton.keyEquivalent = "\r"
        renameButton.bezelStyle = .rounded

        let heading = NSStackView(views: [title, subtitle])
        heading.orientation = .vertical
        heading.alignment = .leading
        heading.spacing = 3
        heading.translatesAutoresizingMaskIntoConstraints = false
        let buttons = NSStackView(views: [cancelButton, renameButton])
        buttons.orientation = .horizontal
        buttons.spacing = 8
        buttons.translatesAutoresizingMaskIntoConstraints = false

        guard let content = panel.contentView else { return }
        for child in [icon, heading, nameField, hint, removeButton, buttons] {
            content.addSubview(child)
            child.translatesAutoresizingMaskIntoConstraints = false
        }
        NSLayoutConstraint.activate([
            icon.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 24),
            icon.topAnchor.constraint(equalTo: content.topAnchor, constant: 26),
            icon.widthAnchor.constraint(equalToConstant: 52),
            icon.heightAnchor.constraint(equalToConstant: 52),
            heading.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 16),
            heading.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -24),
            heading.centerYAnchor.constraint(equalTo: icon.centerYAnchor),
            nameField.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 24),
            nameField.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -24),
            nameField.topAnchor.constraint(equalTo: icon.bottomAnchor, constant: 20),
            nameField.heightAnchor.constraint(equalToConstant: 26),
            hint.leadingAnchor.constraint(equalTo: nameField.leadingAnchor),
            hint.topAnchor.constraint(equalTo: nameField.bottomAnchor, constant: 5),
            removeButton.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 20),
            removeButton.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -18),
            buttons.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -20),
            buttons.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -16),
        ])
        panel.initialFirstResponder = nameField
        panel.defaultButtonCell = renameButton.cell as? NSButtonCell
    }

    func run() -> RenameDesktopResult {
        NSApp.activate(ignoringOtherApps: true)
        panel.center()
        panel.makeKeyAndOrderFront(nil)
        panel.makeFirstResponder(nameField)
        NSApp.runModal(for: panel)
        panel.orderOut(nil)
        return result
    }

    @objc private func rename() {
        let name = nameField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        result = name.isEmpty ? .removeName : .rename(name)
        NSApp.stopModal()
    }

    @objc private func removeName() {
        result = .removeName
        NSApp.stopModal()
    }

    @objc private func cancel() {
        result = .cancel
        NSApp.stopModal()
    }
}
