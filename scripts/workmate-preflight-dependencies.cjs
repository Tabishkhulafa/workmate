'use strict';

// Read-only dependency check. Node JSON.parse supports the empty-string
// "packages['']" key in npm package-lock files (Windows PowerShell 5.1 does not).
const fs = require('node:fs');
const path = require('node:path');

try {
  const root = process.cwd();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const declared = pkg.dependencies?.exceljs ?? pkg.devDependencies?.exceljs ?? '';
  const installedLock = lock.packages?.['node_modules/exceljs']?.version ?? '';

  process.stdout.write(`ExcelJS manifest: ${declared || 'MISSING'}\n`);
  process.stdout.write(`ExcelJS lockfile: ${installedLock || 'MISSING'}\n`);

  if (!declared || !installedLock) {
    console.error('FAIL: ExcelJS is missing from the manifest or lockfile. Run: npm.cmd install exceljs@4.4.0 --save-exact');
    process.exitCode = 1;
  } else if (declared !== installedLock) {
    console.error('FAIL: ExcelJS versions differ. Reconcile package.json and package-lock.json before production.');
    process.exitCode = 1;
  } else {
    console.log('ExcelJS dependency: PASS');
  }
} catch (error) {
  console.error(`FAIL: Unable to read package.json/package-lock.json: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
