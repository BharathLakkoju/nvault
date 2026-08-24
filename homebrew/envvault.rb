# Homebrew formula for the envvault CLI — installs a precompiled,
# dependency-free binary (built by `pkg`, see .github/workflows/cli-release.yml).
# No Node.js dependency: this downloads the same standalone executable
# published on every GitHub Release, not an npm install.
#
# To make `brew install envvault` work, this file needs to live at
# `Formula/envvault.rb` in a repo named `homebrew-envvault` (Homebrew's tap
# naming convention) — copy it there after creating that repo. See
# scripts/update-homebrew-formula.sh for how the version/url/sha256 values
# below get regenerated after each release.
class Envvault < Formula
  desc "Secure, zero-knowledge developer environment/config vault CLI"
  homepage "https://github.com/BharathLakkoju/nvault"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/BharathLakkoju/nvault/releases/download/cli-v0.1.0/envvault-macos-arm64"
      sha256 "REPLACE_WITH_MACOS_ARM64_SHA256"
    end
    on_intel do
      url "https://github.com/BharathLakkoju/nvault/releases/download/cli-v0.1.0/envvault-macos-x64"
      sha256 "REPLACE_WITH_MACOS_X64_SHA256"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/BharathLakkoju/nvault/releases/download/cli-v0.1.0/envvault-linux-x64"
      sha256 "REPLACE_WITH_LINUX_X64_SHA256"
    end
  end

  def install
    # Exactly one of the platform-specific assets above was actually
    # downloaded (Homebrew resolves the on_macos/on_linux/on_arm/on_intel
    # blocks against the current system before fetching) — pick it up by
    # glob rather than duplicating that platform logic here.
    bin.install Dir["envvault-*"].first => "envvault"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/envvault --version")
  end
end
