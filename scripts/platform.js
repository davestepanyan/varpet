"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");

/**
 * Maps Node.js platform/arch to our naming convention.
 *
 * @returns {{ platform: string, packageName: string, binaryName: string } | null}
 */
function getPlatformInfo() {
  const platform = os.platform();
  const arch = os.arch();

  const PLATFORMS = {
    "darwin-arm64": {
      platform: "darwin-arm64",
      packageName: "@varpet/darwin-arm64",
      binaryName: "varpet",
    },
    "darwin-x64": {
      platform: "darwin-x64",
      packageName: "@varpet/darwin-x64",
      binaryName: "varpet",
    },
    "linux-x64": {
      platform: "linux-x64",
      packageName: "@varpet/linux-x64",
      binaryName: "varpet",
    },
    "win32-x64": {
      platform: "win32-x64",
      packageName: "@varpet/win32-x64",
      binaryName: "varpet.exe",
    },
  };

  const key = `${platform}-${arch}`;
  return PLATFORMS[key] || null;
}

/**
 * Resolve the path to the varpet binary.
 *
 * Resolution order:
 *   1. @varpet/<platform> optional dependency (npm installed it)
 *   2. Local binary downloaded by postinstall fallback
 *   3. null (not found)
 *
 * @returns {string | null} Absolute path to the binary, or null if not found.
 */
function getBinaryPath() {
  const info = getPlatformInfo();
  if (!info) {
    return null;
  }

  // 1. Try the optional platform package
  try {
    const pkgPath = require.resolve(
      `${info.packageName}/bin/${info.binaryName}`
    );
    if (fs.existsSync(pkgPath)) {
      return pkgPath;
    }
  } catch (_) {
    // Optional package not installed — fall through
  }

  // 2. Try local binary (downloaded by postinstall fallback)
  const localBinary = path.join(
    __dirname,
    "..",
    "bin",
    `varpet-${info.platform}${info.platform.startsWith("win32") ? ".exe" : ""}`
  );
  if (fs.existsSync(localBinary)) {
    return localBinary;
  }

  return null;
}

module.exports = {
  getPlatformInfo,
  getBinaryPath,
};
