#!/usr/bin/env node

"use strict";

const { execFileSync } = require("child_process");
const { getBinaryPath, getPlatformInfo } = require("../scripts/platform");

const binary = getBinaryPath();

if (!binary) {
  const info = getPlatformInfo();
  if (!info) {
    console.error(
      "Error: varpet does not support this platform (" +
        process.platform +
        "-" +
        process.arch +
        ").\n" +
        "Supported platforms: darwin-arm64, darwin-x64, linux-x64, win32-x64"
    );
  } else {
    console.error(
      "Error: varpet binary not found.\n" +
        "The platform package " +
        info.packageName +
        " may not have been installed correctly.\n" +
        "Try reinstalling: npm install -g varpet"
    );
  }
  process.exit(1);
}

try {
  execFileSync(binary, process.argv.slice(2), {
    stdio: "inherit",
    env: process.env,
  });
} catch (e) {
  // execFileSync throws on non-zero exit codes. Forward the exit code.
  if (e.status !== null && e.status !== undefined) {
    process.exit(e.status);
  }
  // If it's a genuine error (binary not found, permission denied, etc.)
  console.error("Error: Failed to execute varpet binary:", e.message);
  process.exit(1);
}
