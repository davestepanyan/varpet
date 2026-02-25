"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { getPlatformInfo, getBinaryPath } = require("./platform");

const GITHUB_OWNER = "davestepanyan";
const GITHUB_REPO = "varpet-core";

/**
 * Read the version from package.json.
 * @returns {string}
 */
function getVersion() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
  );
  return pkg.version;
}

/**
 * Follow redirects and download a file from a URL.
 *
 * @param {string} url
 * @param {string} dest
 * @param {number} maxRedirects
 * @returns {Promise<void>}
 */
function download(url, dest, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error("Too many redirects"));
    }

    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        "User-Agent": "varpet-npm-installer",
        Accept: "application/octet-stream",
      },
    };

    // Use GitHub token if available (for private repos)
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    https
      .get(options, (res) => {
        // Handle redirects (GitHub releases redirect to S3)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return download(res.headers.location, dest, maxRedirects - 1).then(
            resolve,
            reject
          );
        }

        if (res.statusCode !== 200) {
          return reject(
            new Error(`Download failed: HTTP ${res.statusCode} for ${url}`)
          );
        }

        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
        file.on("error", (err) => {
          fs.unlinkSync(dest);
          reject(err);
        });
      })
      .on("error", reject);
  });
}

/**
 * Extract a .tar.gz archive to a directory.
 *
 * @param {string} archive
 * @param {string} destDir
 */
function extractTarGz(archive, destDir) {
  execSync(`tar -xzf "${archive}" -C "${destDir}"`, { stdio: "pipe" });
}

/**
 * Extract a .zip archive to a directory (Windows).
 *
 * @param {string} archive
 * @param {string} destDir
 */
function extractZip(archive, destDir) {
  // Use PowerShell on Windows
  execSync(
    `powershell -Command "Expand-Archive -Path '${archive}' -DestinationPath '${destDir}' -Force"`,
    { stdio: "pipe" }
  );
}

/**
 * Main postinstall logic.
 */
async function main() {
  const info = getPlatformInfo();
  if (!info) {
    console.warn(
      "[varpet] Warning: Unsupported platform (" +
        process.platform +
        "-" +
        process.arch +
        "). " +
        "Supported: darwin-arm64, darwin-x64, linux-x64, win32-x64"
    );
    return;
  }

  // Check if the optional platform package already installed the binary
  const existingBinary = getBinaryPath();
  if (existingBinary) {
    // Binary found — verify it works
    try {
      execSync(`"${existingBinary}" --version`, {
        stdio: "pipe",
        timeout: 10000,
      });
      return; // All good
    } catch (_) {
      // Binary exists but doesn't work — fall through to download
      console.warn("[varpet] Platform binary found but failed verification. Re-downloading...");
    }
  }

  // Fallback: download the binary from GitHub Releases
  const version = getVersion();
  const isWindows = info.platform.startsWith("win32");
  const ext = isWindows ? "zip" : "tar.gz";
  const archiveName = `varpet-${info.platform}.${ext}`;
  const downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${version}/${archiveName}`;

  console.log(`[varpet] Downloading binary for ${info.platform}...`);
  console.log(`[varpet] URL: ${downloadUrl}`);

  const binDir = path.join(__dirname, "..", "bin");
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const archivePath = path.join(binDir, archiveName);

  try {
    await download(downloadUrl, archivePath);
  } catch (err) {
    console.warn(
      `[varpet] Warning: Failed to download binary: ${err.message}\n` +
        "[varpet] The varpet command will not work until the binary is available.\n" +
        "[varpet] You may need to set GITHUB_TOKEN for private repo access."
    );
    return;
  }

  // Extract
  try {
    if (isWindows) {
      extractZip(archivePath, binDir);
    } else {
      extractTarGz(archivePath, binDir);
    }
  } catch (err) {
    console.warn(`[varpet] Warning: Failed to extract archive: ${err.message}`);
    cleanup(archivePath);
    return;
  }

  // Rename extracted binary to include platform suffix (for getBinaryPath fallback)
  const extractedName = isWindows ? "varpet.exe" : "varpet";
  const extractedPath = path.join(binDir, extractedName);
  const targetName = isWindows
    ? `varpet-${info.platform}.exe`
    : `varpet-${info.platform}`;
  const targetPath = path.join(binDir, targetName);

  if (fs.existsSync(extractedPath) && extractedPath !== targetPath) {
    fs.renameSync(extractedPath, targetPath);
  }

  // Make executable on unix
  if (!isWindows && fs.existsSync(targetPath)) {
    fs.chmodSync(targetPath, 0o755);
  }

  // Clean up archive
  cleanup(archivePath);

  // Verify
  try {
    execSync(`"${targetPath}" --version`, { stdio: "pipe", timeout: 10000 });
    console.log(`[varpet] Binary installed successfully for ${info.platform}`);
  } catch (_) {
    console.warn(
      "[varpet] Warning: Binary was downloaded but verification failed.\n" +
        "[varpet] The varpet command may not work correctly."
    );
  }
}

/**
 * Remove a file if it exists.
 * @param {string} filePath
 */
function cleanup(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {
    // Best-effort cleanup
  }
}

main().catch((err) => {
  // Postinstall failures should warn, not fail the entire npm install
  console.warn(`[varpet] Warning: postinstall failed: ${err.message}`);
});
