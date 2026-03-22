cask "jumpee" do
  version "1.0.0"
  sha256 "ac673777db3748f044784d9ee38f4c028605b239e6f9e2f8041d75366fac1655"

  # TODO: Replace with your GitHub release URL after pushing to GitHub
  # url "https://github.com/BikS2013/jumpee/releases/download/v#{version}/Jumpee-#{version}.zip"
  #
  # For local development, use file URL (uncomment and adjust path):
  # url "file:///Users/giorgosmarinos/aiwork/coding-platform/macbook-desktop/Jumpee/dist/Jumpee-#{version}.zip"

  url "https://github.com/BikS2013/jumpee/releases/download/v#{version}/Jumpee-#{version}.zip"
  name "Jumpee"
  desc "macOS menu bar app for naming and jumping between Mission Control desktops"
  homepage "https://github.com/BikS2013/jumpee"

  depends_on macos: ">= :ventura"

  app "Jumpee.app"

  postflight do
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

    Global hotkey: Cmd+J (configurable in ~/.Jumpee/config.json)
  EOS
end
