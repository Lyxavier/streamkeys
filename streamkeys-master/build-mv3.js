#!/usr/bin/env node

/**
 * Simple build script for Streamkeys MV3
 * This creates a build directory with the MV3 version
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, 'code');
const buildDir = path.join(__dirname, 'build', 'mv3');

// Ensure build directory exists
if (!fs.existsSync(path.join(__dirname, 'build'))) {
  fs.mkdirSync(path.join(__dirname, 'build'));
}

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

// Copy all files from code directory
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName),
                       path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('Building Streamkeys MV3...');
copyRecursiveSync(sourceDir, buildDir);

console.log('✅ Build complete! Extension ready in:', buildDir);
console.log('📖 Load this directory in Chrome Developer Mode to test the extension.');
