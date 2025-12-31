#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const functionsDir = __dirname;

// Get all function directories
const functionDirs = fs.readdirSync(functionsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => !name.startsWith('.') && name !== 'node_modules');

console.log(`\nPhase 2: Adding error checks\nFound ${functionDirs.length} functions to process\n`);

functionDirs.forEach(funcName => {
    const indexPath = path.join(functionsDir, funcName, 'index.ts');
    
    if (!fs.existsSync(indexPath)) {
        return;
    }
    
    let content = fs.readFileSync(indexPath, 'utf8');
    let modified = false;
    
    // Add error checks after queries with .length checks
    // Pattern: if (varName.length === 0) { ... }
    // Should add error check before it
    const lengthCheckPattern = /if \((\w+)\.length === 0\) \{/g;
    const matches = [...content.matchAll(lengthCheckPattern)];
    
    for (const match of matches.reverse()) { // Reverse to preserve indices
        const varName = match[1];
        const errorVar = `${varName}Error`;
        const index = match.index;
        
        // Check if error handling already exists
        const beforeMatch = content.substring(Math.max(0, index - 200), index);
        if (beforeMatch.includes(`if (${errorVar}`)) {
            continue; // Already has error check
        }
        
        // Insert error check before the length check
        const indent = match[0].match(/^(\s*)/)?.[1] || '        ';
        const errorCheck = `${indent}if (${errorVar} || !${varName}) {\n${indent}    return Response.json({ error: 'Database error' }, { status: 500 });\n${indent}}\n${indent}`;
        
        content = content.substring(0, index) + errorCheck + content.substring(index);
        modified = true;
    }
    
    if (modified) {
        fs.writeFileSync(indexPath, content, 'utf8');
        console.log(`  ✓ Added error checks to ${funcName}`);
    } else {
        console.log(`  • No error checks needed for ${funcName}`);
    }
});

console.log('\n✓ All functions processed');
