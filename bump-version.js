#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGE_NAME = '@augmentcode/auggie';
const EXTENSION_TOML_PATH = path.join(__dirname, 'extension.toml');

/**
 * Fetch the latest version of a package from npm registry
 */
function getLatestVersion(packageName) {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${packageName}/latest`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.version);
        } catch (error) {
          reject(new Error(`Failed to parse npm registry response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to fetch package info: ${error.message}`));
    });
  });
}

/**
 * Update the extension.toml file with the new version.
 * Sets both the extension version and archive URLs to the same version.
 */
function updateExtensionToml(newVersion) {
  try {
    let content = fs.readFileSync(EXTENSION_TOML_PATH, 'utf8');

    // Read current versions for logging
    const currentExtVersionMatch = content.match(/^version = "([\d.]+)"$/m);
    const currentExtVersion = currentExtVersionMatch ? currentExtVersionMatch[1] : 'unknown';
    const currentPkgMatch = content.match(/auggie-([\d.]+)\.tgz/);
    const currentPkgVersion = currentPkgMatch ? currentPkgMatch[1] : 'unknown';

    // Update the extension version to match the package version
    content = content.replace(
      /^version = "[\d.]+"$/m,
      `version = "${newVersion}"`
    );
    console.log(`Updated extension version: ${currentExtVersion} -> ${newVersion}`);

    // Update the archive URLs for all targets
    const oldUrlPattern = /archive = "https:\/\/registry\.npmjs\.org\/@augmentcode\/auggie\/-\/auggie-[\d.]+\.tgz"/g;
    const newUrl = `archive = "https://registry.npmjs.org/@augmentcode/auggie/-/auggie-${newVersion}.tgz"`;
    content = content.replace(oldUrlPattern, newUrl);
    console.log(`Updated auggie package version: ${currentPkgVersion} -> ${newVersion}`);

    fs.writeFileSync(EXTENSION_TOML_PATH, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`Failed to update extension.toml: ${error.message}`);
    return false;
  }
}

function printUsage() {
  console.log('Usage: node bump-version.js [version]');
  console.log('');
  console.log('  version   Explicit version to bump to (e.g. 0.16.0)');
  console.log('            If omitted, fetches the latest version from npm.');
  console.log('');
  console.log('Examples:');
  console.log('  node bump-version.js           # bump to latest npm version');
  console.log('  node bump-version.js 0.16.0    # bump to specific version');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const explicitVersion = args[0];

  try {
    let targetVersion;

    if (explicitVersion) {
      if (!/^\d+\.\d+\.\d+$/.test(explicitVersion)) {
        console.error(`Error: Invalid version format "${explicitVersion}". Expected semver (e.g. 0.16.0)`);
        process.exit(1);
      }
      targetVersion = explicitVersion;
      console.log(`Using explicit version: ${targetVersion}`);
    } else {
      console.log(`Fetching latest version of ${PACKAGE_NAME}...`);
      targetVersion = await getLatestVersion(PACKAGE_NAME);
      console.log(`Latest version: ${targetVersion}`);
    }

    // Check current version in extension.toml
    const content = fs.readFileSync(EXTENSION_TOML_PATH, 'utf8');
    const currentMatch = content.match(/auggie-([\d.]+)\.tgz/);
    const currentVersion = currentMatch ? currentMatch[1] : 'unknown';

    if (currentVersion === targetVersion) {
      console.log(`Already at version ${targetVersion}. No update needed.`);
      return;
    }

    console.log(`Bumping from ${currentVersion} to ${targetVersion}...`);

    const success = updateExtensionToml(targetVersion);

    if (success) {
      console.log('✓ Version bump completed successfully!');
    } else {
      console.error('✗ Version bump failed');
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
