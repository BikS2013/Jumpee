cask "jumpee" do
  version "1.4.0"
  sha256 "f0522d45b2f10d19c1663f639e980fe9575036bf96deba325c2ab9f321af1b3e"

  url "https://github.com/BikS2013/Jumpee/releases/download/v#{version}/Jumpee-#{version}.zip"
  name "Jumpee"
  desc "macOS menu bar app for naming, jumping between desktops, and pinning windows on top"
  homepage "https://github.com/BikS2013/Jumpee"

  depends_on macos: ">= :ventura"

  app "Jumpee.app"

  postflight do
    system "xattr", "-d", "com.apple.quarantine", "#{appdir}/Jumpee.app"
    system "osascript", "-e",
      'display notification "Jumpee installed. Grant Accessibility permissions in System Settings > Privacy & Security > Accessibility." with title "Jumpee"'
  end

  zap trash: [
    "~/.Jumpee",
  ]

  caveats <<~EOS
    Jumpee requires Accessibility permissions to switch desktops:
      System Settings > Privacy & Security > Accessibility > enable Jumpee

    Mission Control keyboard shortcuts (Ctrl+1 through Ctrl+9) must be enabled:
      System Settings > Keyboard > Keyboard Shortcuts > Mission Control

    Pin Window on Top requires Screen Recording permission:
      System Settings > Privacy & Security > Screen Recording > enable Jumpee

    To start Jumpee at login:
      System Settings > General > Login Items > add Jumpee

    Global hotkeys (configurable from the Hotkeys section in the menu):
      Cmd+J       — open dropdown menu
      Cmd+M       — move focused window to another desktop (requires moveWindow.enabled)
      Ctrl+Cmd+P  — pin/unpin focused window on top (requires pinWindow.enabled)
  EOS
end
