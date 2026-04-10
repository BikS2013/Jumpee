// test-input-source-config.swift
// Standalone test for InputSourceIndicatorConfig JSON decoding and defaults.
//
// Compile & run:
//   swiftc test_scripts/test-input-source-config.swift -o /tmp/test-input-source-config && /tmp/test-input-source-config

import Foundation

// ============================================================================
// MARK: - Minimal reproduction of config structs from Sources/main.swift
// ============================================================================

struct OverlayConfig: Codable {
    var enabled: Bool
    var opacity: Double
    var fontName: String
    var fontSize: Double
    var fontWeight: String
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
}

struct MoveWindowConfig: Codable {
    var enabled: Bool
}

struct PinWindowConfig: Codable {
    var enabled: Bool
}

struct InputSourceIndicatorConfig: Codable {
    var enabled: Bool

    var fontSize: Double?
    var fontName: String?
    var fontWeight: String?
    var textColor: String?
    var opacity: Double?
    var backgroundColor: String?
    var backgroundOpacity: Double?
    var backgroundCornerRadius: Double?
    var verticalOffset: Double?

    static let defaultFontSize: Double = 60
    static let defaultFontName: String = "Helvetica Neue"
    static let defaultFontWeight: String = "bold"
    static let defaultTextColor: String = "#FFFFFF"
    static let defaultOpacity: Double = 0.8
    static let defaultBackgroundColor: String = "#000000"
    static let defaultBackgroundOpacity: Double = 0.3
    static let defaultBackgroundCornerRadius: Double = 10
    static let defaultVerticalOffset: Double = 0

    var effectiveFontSize: Double { fontSize ?? Self.defaultFontSize }
    var effectiveFontName: String { fontName ?? Self.defaultFontName }
    var effectiveFontWeight: String { fontWeight ?? Self.defaultFontWeight }
    var effectiveTextColor: String { textColor ?? Self.defaultTextColor }
    var effectiveOpacity: Double { opacity ?? Self.defaultOpacity }
    var effectiveBackgroundColor: String { backgroundColor ?? Self.defaultBackgroundColor }
    var effectiveBackgroundOpacity: Double { backgroundOpacity ?? Self.defaultBackgroundOpacity }
    var effectiveBackgroundCornerRadius: Double { backgroundCornerRadius ?? Self.defaultBackgroundCornerRadius }
    var effectiveVerticalOffset: Double { verticalOffset ?? Self.defaultVerticalOffset }
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
}

// ============================================================================
// MARK: - Test Harness
// ============================================================================

var totalTests = 0
var passedTests = 0
var failedTests = 0

func assert(_ condition: Bool, _ message: String, file: String = #file, line: Int = #line) {
    totalTests += 1
    if condition {
        passedTests += 1
        print("  PASS: \(message)")
    } else {
        failedTests += 1
        print("  FAIL: \(message) (line \(line))")
    }
}

func section(_ title: String) {
    print("\n--- \(title) ---")
}

// ============================================================================
// MARK: - Tests
// ============================================================================

section("1. Decode minimal InputSourceIndicatorConfig (enabled only)")
do {
    let json = """
    { "enabled": true }
    """.data(using: .utf8)!
    let config = try JSONDecoder().decode(InputSourceIndicatorConfig.self, from: json)
    assert(config.enabled == true, "enabled is true")
    assert(config.fontSize == nil, "fontSize is nil (not provided)")
    assert(config.fontName == nil, "fontName is nil (not provided)")
    assert(config.fontWeight == nil, "fontWeight is nil (not provided)")
    assert(config.textColor == nil, "textColor is nil (not provided)")
    assert(config.opacity == nil, "opacity is nil (not provided)")
    assert(config.backgroundColor == nil, "backgroundColor is nil (not provided)")
    assert(config.backgroundOpacity == nil, "backgroundOpacity is nil (not provided)")
    assert(config.backgroundCornerRadius == nil, "backgroundCornerRadius is nil (not provided)")
    assert(config.verticalOffset == nil, "verticalOffset is nil (not provided)")
}

section("2. Effective defaults when optional fields are nil")
do {
    let json = """
    { "enabled": true }
    """.data(using: .utf8)!
    let config = try JSONDecoder().decode(InputSourceIndicatorConfig.self, from: json)
    assert(config.effectiveFontSize == 60, "effectiveFontSize == 60")
    assert(config.effectiveFontName == "Helvetica Neue", "effectiveFontName == Helvetica Neue")
    assert(config.effectiveFontWeight == "bold", "effectiveFontWeight == bold")
    assert(config.effectiveTextColor == "#FFFFFF", "effectiveTextColor == #FFFFFF")
    assert(config.effectiveOpacity == 0.8, "effectiveOpacity == 0.8")
    assert(config.effectiveBackgroundColor == "#000000", "effectiveBackgroundColor == #000000")
    assert(config.effectiveBackgroundOpacity == 0.3, "effectiveBackgroundOpacity == 0.3")
    assert(config.effectiveBackgroundCornerRadius == 10, "effectiveBackgroundCornerRadius == 10")
    assert(config.effectiveVerticalOffset == 0, "effectiveVerticalOffset == 0")
}

section("3. Decode fully specified config")
do {
    let json = """
    {
      "enabled": true,
      "fontSize": 48,
      "fontName": "Arial",
      "fontWeight": "heavy",
      "textColor": "#00FF00",
      "opacity": 0.5,
      "backgroundColor": "#FF0000",
      "backgroundOpacity": 0.7,
      "backgroundCornerRadius": 20,
      "verticalOffset": 15
    }
    """.data(using: .utf8)!
    let config = try JSONDecoder().decode(InputSourceIndicatorConfig.self, from: json)
    assert(config.enabled == true, "enabled is true")
    assert(config.effectiveFontSize == 48, "effectiveFontSize == 48 (overridden)")
    assert(config.effectiveFontName == "Arial", "effectiveFontName == Arial (overridden)")
    assert(config.effectiveFontWeight == "heavy", "effectiveFontWeight == heavy (overridden)")
    assert(config.effectiveTextColor == "#00FF00", "effectiveTextColor == #00FF00 (overridden)")
    assert(config.effectiveOpacity == 0.5, "effectiveOpacity == 0.5 (overridden)")
    assert(config.effectiveBackgroundColor == "#FF0000", "effectiveBackgroundColor == #FF0000 (overridden)")
    assert(config.effectiveBackgroundOpacity == 0.7, "effectiveBackgroundOpacity == 0.7 (overridden)")
    assert(config.effectiveBackgroundCornerRadius == 20, "effectiveBackgroundCornerRadius == 20 (overridden)")
    assert(config.effectiveVerticalOffset == 15, "effectiveVerticalOffset == 15 (overridden)")
}

section("4. Decode partial config (some fields overridden, rest default)")
do {
    let json = """
    {
      "enabled": false,
      "fontSize": 30,
      "textColor": "#AABBCC"
    }
    """.data(using: .utf8)!
    let config = try JSONDecoder().decode(InputSourceIndicatorConfig.self, from: json)
    assert(config.enabled == false, "enabled is false")
    assert(config.effectiveFontSize == 30, "effectiveFontSize == 30 (overridden)")
    assert(config.effectiveFontName == "Helvetica Neue", "effectiveFontName uses default")
    assert(config.effectiveFontWeight == "bold", "effectiveFontWeight uses default")
    assert(config.effectiveTextColor == "#AABBCC", "effectiveTextColor == #AABBCC (overridden)")
    assert(config.effectiveOpacity == 0.8, "effectiveOpacity uses default")
    assert(config.effectiveBackgroundColor == "#000000", "effectiveBackgroundColor uses default")
}

section("5. JumpeeConfig with inputSourceIndicator present")
do {
    let json = """
    {
      "spaces": {},
      "showSpaceNumber": true,
      "overlay": {
        "enabled": true,
        "opacity": 0.15,
        "fontName": "Helvetica Neue",
        "fontSize": 72,
        "fontWeight": "bold",
        "position": "top-center",
        "textColor": "#FF0000",
        "margin": 40
      },
      "hotkey": { "key": "j", "modifiers": ["command"] },
      "inputSourceIndicator": {
        "enabled": true,
        "fontSize": 80
      }
    }
    """.data(using: .utf8)!
    let config = try JSONDecoder().decode(JumpeeConfig.self, from: json)
    assert(config.inputSourceIndicator != nil, "inputSourceIndicator is present")
    assert(config.inputSourceIndicator?.enabled == true, "inputSourceIndicator.enabled is true")
    assert(config.inputSourceIndicator?.effectiveFontSize == 80, "fontSize overridden to 80")
    assert(config.inputSourceIndicator?.effectiveFontName == "Helvetica Neue", "fontName uses default")
}

section("6. JumpeeConfig without inputSourceIndicator (feature disabled)")
do {
    let json = """
    {
      "spaces": {},
      "showSpaceNumber": true,
      "overlay": {
        "enabled": true,
        "opacity": 0.15,
        "fontName": "Helvetica Neue",
        "fontSize": 72,
        "fontWeight": "bold",
        "position": "top-center",
        "textColor": "#FF0000",
        "margin": 40
      },
      "hotkey": { "key": "j", "modifiers": ["command"] }
    }
    """.data(using: .utf8)!
    let config = try JSONDecoder().decode(JumpeeConfig.self, from: json)
    assert(config.inputSourceIndicator == nil, "inputSourceIndicator is nil when absent")
    assert(config.inputSourceIndicator?.enabled != true, "feature is not enabled")
}

section("7. JumpeeConfig with inputSourceIndicator.enabled = false")
do {
    let json = """
    {
      "spaces": {},
      "showSpaceNumber": true,
      "overlay": {
        "enabled": true,
        "opacity": 0.15,
        "fontName": "Helvetica Neue",
        "fontSize": 72,
        "fontWeight": "bold",
        "position": "top-center",
        "textColor": "#FF0000",
        "margin": 40
      },
      "hotkey": { "key": "j", "modifiers": ["command"] },
      "inputSourceIndicator": {
        "enabled": false
      }
    }
    """.data(using: .utf8)!
    let config = try JSONDecoder().decode(JumpeeConfig.self, from: json)
    assert(config.inputSourceIndicator != nil, "inputSourceIndicator section exists")
    assert(config.inputSourceIndicator?.enabled == false, "enabled is false")
}

section("8. Edge case: empty inputSourceIndicator object should fail (enabled is required)")
do {
    let json = """
    {
      "spaces": {},
      "showSpaceNumber": true,
      "overlay": {
        "enabled": true,
        "opacity": 0.15,
        "fontName": "Helvetica Neue",
        "fontSize": 72,
        "fontWeight": "bold",
        "position": "top-center",
        "textColor": "#FF0000",
        "margin": 40
      },
      "hotkey": { "key": "j", "modifiers": ["command"] },
      "inputSourceIndicator": {}
    }
    """.data(using: .utf8)!
    do {
        let _ = try JSONDecoder().decode(JumpeeConfig.self, from: json)
        assert(false, "Should fail to decode empty inputSourceIndicator (missing required 'enabled')")
    } catch {
        assert(true, "Empty inputSourceIndicator correctly fails to decode: \(error.localizedDescription)")
    }
}

section("9. Edge case: opacity at boundary values")
do {
    let json = """
    {
      "enabled": true,
      "opacity": 0.0,
      "backgroundOpacity": 1.0
    }
    """.data(using: .utf8)!
    let config = try JSONDecoder().decode(InputSourceIndicatorConfig.self, from: json)
    assert(config.effectiveOpacity == 0.0, "opacity 0.0 accepted")
    assert(config.effectiveBackgroundOpacity == 1.0, "backgroundOpacity 1.0 accepted")
}

section("10. Edge case: negative verticalOffset")
do {
    let json = """
    {
      "enabled": true,
      "verticalOffset": -10
    }
    """.data(using: .utf8)!
    let config = try JSONDecoder().decode(InputSourceIndicatorConfig.self, from: json)
    assert(config.effectiveVerticalOffset == -10, "negative verticalOffset (-10) accepted")
}

section("11. Static default constants match documented values")
do {
    assert(InputSourceIndicatorConfig.defaultFontSize == 60, "defaultFontSize == 60")
    assert(InputSourceIndicatorConfig.defaultFontName == "Helvetica Neue", "defaultFontName == Helvetica Neue")
    assert(InputSourceIndicatorConfig.defaultFontWeight == "bold", "defaultFontWeight == bold")
    assert(InputSourceIndicatorConfig.defaultTextColor == "#FFFFFF", "defaultTextColor == #FFFFFF")
    assert(InputSourceIndicatorConfig.defaultOpacity == 0.8, "defaultOpacity == 0.8")
    assert(InputSourceIndicatorConfig.defaultBackgroundColor == "#000000", "defaultBackgroundColor == #000000")
    assert(InputSourceIndicatorConfig.defaultBackgroundOpacity == 0.3, "defaultBackgroundOpacity == 0.3")
    assert(InputSourceIndicatorConfig.defaultBackgroundCornerRadius == 10, "defaultBackgroundCornerRadius == 10")
    assert(InputSourceIndicatorConfig.defaultVerticalOffset == 0, "defaultVerticalOffset == 0")
}

section("12. Roundtrip encode/decode preserves values")
do {
    let original = InputSourceIndicatorConfig(
        enabled: true,
        fontSize: 42,
        fontName: "Menlo",
        fontWeight: "light",
        textColor: "#112233",
        opacity: 0.6,
        backgroundColor: "#445566",
        backgroundOpacity: 0.9,
        backgroundCornerRadius: 5,
        verticalOffset: 20
    )
    let encoder = JSONEncoder()
    let data = try encoder.encode(original)
    let decoded = try JSONDecoder().decode(InputSourceIndicatorConfig.self, from: data)
    assert(decoded.enabled == original.enabled, "roundtrip: enabled preserved")
    assert(decoded.fontSize == original.fontSize, "roundtrip: fontSize preserved")
    assert(decoded.fontName == original.fontName, "roundtrip: fontName preserved")
    assert(decoded.fontWeight == original.fontWeight, "roundtrip: fontWeight preserved")
    assert(decoded.textColor == original.textColor, "roundtrip: textColor preserved")
    assert(decoded.opacity == original.opacity, "roundtrip: opacity preserved")
    assert(decoded.backgroundColor == original.backgroundColor, "roundtrip: backgroundColor preserved")
    assert(decoded.backgroundOpacity == original.backgroundOpacity, "roundtrip: backgroundOpacity preserved")
    assert(decoded.backgroundCornerRadius == original.backgroundCornerRadius, "roundtrip: backgroundCornerRadius preserved")
    assert(decoded.verticalOffset == original.verticalOffset, "roundtrip: verticalOffset preserved")
}

section("13. JumpeeConfig coexistence with other optional features")
do {
    let json = """
    {
      "spaces": {"123": "Dev"},
      "showSpaceNumber": false,
      "overlay": {
        "enabled": false,
        "opacity": 0.15,
        "fontName": "Helvetica Neue",
        "fontSize": 72,
        "fontWeight": "bold",
        "position": "top-center",
        "textColor": "#FF0000",
        "margin": 40
      },
      "hotkey": { "key": "j", "modifiers": ["command"] },
      "moveWindow": { "enabled": true },
      "pinWindow": { "enabled": true },
      "inputSourceIndicator": { "enabled": true }
    }
    """.data(using: .utf8)!
    let config = try JSONDecoder().decode(JumpeeConfig.self, from: json)
    assert(config.moveWindow?.enabled == true, "moveWindow enabled alongside ISI")
    assert(config.pinWindow?.enabled == true, "pinWindow enabled alongside ISI")
    assert(config.inputSourceIndicator?.enabled == true, "inputSourceIndicator enabled")
    assert(config.overlay.enabled == false, "overlay can be independently disabled")
}

// ============================================================================
// MARK: - Summary
// ============================================================================

print("\n========================================")
print("Test Summary: \(passedTests)/\(totalTests) passed, \(failedTests) failed")
print("========================================")

if failedTests > 0 {
    exit(1)
} else {
    print("All tests passed.")
    exit(0)
}
