const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');
const gitignorePath = path.join(rootDir, '.gitignore');

console.log('====================================================');
console.log('  VitaLink Configuration & Environment Validation   ');
console.log('====================================================\n');

// 1. Check whether root .env exists
const envExists = fs.existsSync(envPath);
console.log(`vitalink/.env exists: ${envExists ? 'YES' : 'NO'}`);

if (!envExists) {
  console.log('\nFATAL: vitalink/.env file was not found.');
  process.exit(1);
}

// Read and parse vitalink/.env without exposing any values
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split(/\r?\n/);
const envVars = {};

for (const line of envLines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const eqIdx = trimmed.indexOf('=');
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    envVars[key] = val;
  }
}

// 2. Required variables check (print ONLY SET or MISSING, never values)
const requiredVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'PORT',
  'CLIENT_URL',
  'ADMIN_EMAIL',
  'SEED_DEMO_DATA'
];

console.log('\n[Required Variables Check]');
const missingRequired = [];
for (const varName of requiredVars) {
  const val = envVars[varName];
  const isSet = typeof val === 'string' && val.length > 0;
  if (varName === 'SEED_DEMO_DATA') {
    const isFalse = val === 'false';
    console.log(`${varName}: ${isSet ? (isFalse ? 'SET (false)' : 'INVALID (must be false)') : 'MISSING'}`);
    if (!isFalse) {
      missingRequired.push('SEED_DEMO_DATA (must be false)');
    }
  } else {
    console.log(`${varName}: ${isSet ? 'SET' : 'MISSING'}`);
    if (!isSet) {
      missingRequired.push(varName);
    }
  }
}

// 3. Validate CLIENT_URL (accept exactly http://localhost:5173, no markdown)
console.log('\n[CLIENT_URL Format Check]');
const clientUrl = envVars['CLIENT_URL'] || '';
if (clientUrl === 'http://localhost:5173') {
  console.log('CLIENT_URL: VALID (http://localhost:5173)');
} else {
  console.log(`CLIENT_URL: ${clientUrl ? 'INVALID_FORMAT' : 'MISSING'}`);
  if (!missingRequired.includes('CLIENT_URL')) {
    missingRequired.push('CLIENT_URL');
  }
}

// 4. Verify .env is listed in .gitignore
console.log('\n[.gitignore Check]');
if (fs.existsSync(gitignorePath)) {
  const gitignoreLines = fs.readFileSync(gitignorePath, 'utf8').split(/\r?\n/);
  const isIgnored = gitignoreLines.some(l => {
    const t = l.trim();
    return t === '.env' || t === '.env*' || t.startsWith('.env');
  });
  console.log(`.env listed in .gitignore: ${isIgnored ? 'YES' : 'NO'}`);
  if (!isIgnored) {
    missingRequired.push('.env_in_gitignore');
  }
} else {
  console.log('.gitignore exists: NO');
  missingRequired.push('.gitignore_missing');
}

// 5. Verify .env.example exists and contains no secrets
console.log('\n[.env.example Check]');
if (fs.existsSync(envExamplePath)) {
  console.log('.env.example exists: YES');
  const exampleLines = fs.readFileSync(envExamplePath, 'utf8').split(/\r?\n/);
  const sensitiveKeys = ['JWT_SECRET', 'ADMIN_PASSWORD', 'DEMO_USER_PASSWORD', 'OPENAI_API_KEY', 'MONGO_URI'];
  let exampleClean = true;
  for (const line of exampleLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const eqIdx = trimmed.indexOf('=');
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      if (sensitiveKeys.includes(key) && val.length > 0) {
        exampleClean = false;
        console.log(`WARNING: .env.example contains non-empty value for sensitive key: ${key}`);
      }
    }
  }
  console.log(`.env.example contains only placeholders/empty values: ${exampleClean ? 'YES' : 'NO'}`);
  if (!exampleClean) {
    missingRequired.push('.env.example_contains_secrets');
  }
} else {
  console.log('.env.example exists: NO');
  missingRequired.push('.env.example_missing');
}

console.log('\n====================================================');
if (missingRequired.length > 0) {
  console.log('VALIDATION RESULT: Configuration incomplete or invalid.');
  console.log('Issues detected:');
  missingRequired.forEach(v => console.log(`  - ${v}`));
  process.exit(1);
} else {
  console.log('VALIDATION RESULT: All configuration items are valid.');
  process.exit(0);
}
