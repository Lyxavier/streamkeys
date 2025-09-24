#!/usr/bin/env node

const fs = require('fs');

// Read the sites-mv3.js file
const sitesFile = './code/js/sites-mv3.js';
let content = fs.readFileSync(sitesFile, 'utf8');

console.log('Updating all controller references to use MV3 versions...');

// Replace all controller references to use MV3 versions
// This will replace "SomeController.js" with "SomeController-mv3.js"
content = content.replace(/controller: "(\w+Controller)\.js"/g, 'controller: "$1-mv3.js"');

// Write the updated content back
fs.writeFileSync(sitesFile, content);

console.log('✅ All controller references updated to MV3 versions!');

// Count how many controllers were updated
const mv3Count = (content.match(/Controller-mv3\.js/g) || []).length;
console.log(`Total MV3 controllers referenced: ${mv3Count}`);
