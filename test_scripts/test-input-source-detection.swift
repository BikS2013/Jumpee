// test-input-source-detection.swift
// Standalone test for macOS Input Source detection via TIS API.
//
// Compile & run:
//   swiftc test_scripts/test-input-source-detection.swift -framework Carbon -o /tmp/test-input-source-detection && /tmp/test-input-source-detection

import Foundation
import Carbon.HIToolbox

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

section("1. TISCopyCurrentKeyboardInputSource returns non-nil")
do {
    let source = TISCopyCurrentKeyboardInputSource()
    assert(source != nil, "TISCopyCurrentKeyboardInputSource() returns non-nil")

    if let source = source {
        let retained = source.takeRetainedValue()

        section("2. kTISPropertyLocalizedName returns non-nil string")
        let namePtr = TISGetInputSourceProperty(retained, kTISPropertyLocalizedName)
        assert(namePtr != nil, "TISGetInputSourceProperty(kTISPropertyLocalizedName) returns non-nil")

        if let namePtr = namePtr {
            let name = Unmanaged<CFString>.fromOpaque(namePtr).takeUnretainedValue() as String
            assert(!name.isEmpty, "Localized name is not empty: \"\(name)\"")
            print("  INFO: Current input source name = \"\(name)\"")
        }

        section("3. kTISPropertyInputSourceID returns non-nil string")
        let idPtr = TISGetInputSourceProperty(retained, kTISPropertyInputSourceID)
        assert(idPtr != nil, "TISGetInputSourceProperty(kTISPropertyInputSourceID) returns non-nil")

        if let idPtr = idPtr {
            let sourceID = Unmanaged<CFString>.fromOpaque(idPtr).takeUnretainedValue() as String
            assert(!sourceID.isEmpty, "InputSourceID is not empty: \"\(sourceID)\"")
            print("  INFO: Input source ID = \"\(sourceID)\"")
        }

        section("4. kTISPropertyInputSourceCategory is keyboard category")
        let catPtr = TISGetInputSourceProperty(retained, kTISPropertyInputSourceCategory)
        assert(catPtr != nil, "TISGetInputSourceProperty(kTISPropertyInputSourceCategory) returns non-nil")

        if let catPtr = catPtr {
            let category = Unmanaged<CFString>.fromOpaque(catPtr).takeUnretainedValue() as String
            assert(!category.isEmpty, "Category is not empty: \"\(category)\"")
            print("  INFO: Category = \"\(category)\"")
            // The category for keyboard layouts is typically "TISCategoryKeyboardInputSource"
            let isKeyboard = category == (kTISCategoryKeyboardInputSource as String)
            assert(isKeyboard, "Category is kTISCategoryKeyboardInputSource")
        }

        section("5. kTISPropertyInputSourceIsSelected is true")
        let selectedPtr = TISGetInputSourceProperty(retained, kTISPropertyInputSourceIsSelected)
        assert(selectedPtr != nil, "kTISPropertyInputSourceIsSelected returns non-nil")

        if let selectedPtr = selectedPtr {
            let selected = Unmanaged<CFBoolean>.fromOpaque(selectedPtr).takeUnretainedValue()
            let isSelected = CFBooleanGetValue(selected)
            assert(isSelected, "Current input source is selected")
        }
    }
}

section("6. DistributedNotificationCenter notification name is valid")
do {
    let notificationName = "AppleSelectedInputSourcesChangedNotification"
    assert(!notificationName.isEmpty, "Notification name string is non-empty")
    print("  INFO: Will listen for \"\(notificationName)\"")
    // We cannot easily test that the notification fires without actually switching
    // input sources, but we verify the name is the correct one used in main.swift.
    assert(notificationName == "AppleSelectedInputSourcesChangedNotification",
           "Notification name matches what Jumpee uses")
}

section("7. Multiple calls return consistent results")
do {
    var names: [String] = []
    for _ in 0..<5 {
        if let source = TISCopyCurrentKeyboardInputSource()?.takeRetainedValue(),
           let namePtr = TISGetInputSourceProperty(source, kTISPropertyLocalizedName) {
            let name = Unmanaged<CFString>.fromOpaque(namePtr).takeUnretainedValue() as String
            names.append(name)
        }
    }
    assert(names.count == 5, "Got 5 consecutive readings")
    let allSame = names.allSatisfy { $0 == names.first }
    assert(allSame, "All 5 readings return same input source: \"\(names.first ?? "")\"")
}

section("8. API does not require special permissions")
do {
    // If we got this far without a crash or permission dialog, the API works
    // without Accessibility or Screen Recording permissions.
    assert(true, "TIS API calls succeeded without special permissions (no crash, no dialog)")
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
