cask "jumpee" do
  version "1.3.0"
  sha256 "cec5de20918f130f881ceeb8a413fdc89ae25069ac2d85c48940a6492498814d"

  url "https://github.com/BikS2013/Jumpee/releases/download/v#{version}/Jumpee-#{version}.zip"
  name "Jumpee"
  desc "macOS menu bar app for naming and jumping between Mission Control desktops"
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

    To start Jumpee at login:
      System Settings > General > Login Items > add Jumpee

    Global hotkeys (configurable from the Hotkeys section in the menu):
      Cmd+J — open dropdown menu
      Cmd+M — move focused window to another desktop (requires moveWindow.enabled)
  EOS
end
