# Style & Conventions

- Single-file Swift app (Sources/main.swift)
- MARK comments for section organization (e.g., `// MARK: - Configuration`)
- Structs with Codable conformance for config
- Static factory methods/properties for defaults
- Extension-based organization for utility methods
- No external dependencies — pure system frameworks
- Private CGS API declarations via @_silgen_name
- No fallback values for configuration (per CLAUDE.md) — but current code uses defaults for initial config
- All tools documented in CLAUDE.md with XML format
