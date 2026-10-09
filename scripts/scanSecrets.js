import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const textExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.sql', '.md', '.yml', '.yaml', '.toml', '.env', '.html', '.css', '.txt']);
const isTextFile = file => textExtensions.has(path.extname(file).toLowerCase()) || path.basename(file).startsWith('.env');
const jwtPattern = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const patterns = [
  { name: 'Telegram bot token', re: /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g },
  { name: 'server credential assignment', re: /(?:SUPABASE_SERVICE_ROLE_KEY|TELEGRAM_BOT_TOKEN|TURNSTILE_SECRET_KEY|DATABASE_URL)[ \t]*[:=][ \t]*["']?(?!your[_-]|replace[_-]|server-only|example|test[_-]|\$|\{)[A-Za-z0-9_./:+-]{20,}/gi },
  { name: 'private key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];
function filesFromGit() { return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean); }
function jwtIsPublicAnon(value) { try { return JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8')).role === 'anon'; } catch { return false; } }
function scanFile(text) {
  const findings = [];
  for (const pattern of patterns) {
    pattern.re.lastIndex = 0;
    if (pattern.re.test(text)) findings.push(pattern.name);
  }
  for (const match of text.matchAll(jwtPattern)) if (!jwtIsPublicAnon(match[0])) findings.push('non-public JWT');
  return [...new Set(findings)];
}
const dirArg = process.argv.indexOf('--dir');
const root = dirArg >= 0 ? path.resolve(process.argv[dirArg + 1] || '.') : process.cwd();
const files = dirArg >= 0 ? (() => { const result = []; const visit = d => { for (const entry of fs.readdirSync(d, { withFileTypes: true })) { const file = path.join(d, entry.name); if (entry.isDirectory()) visit(file); else if (isTextFile(file)) result.push(file); } }; visit(root); return result; })() : filesFromGit().filter(isTextFile);
const findings = [];
for (const file of files) { try { const types = scanFile(fs.readFileSync(path.resolve(file), 'utf8')); if (types.length) findings.push(`${path.relative(process.cwd(), file)} (${types.join(', ')})`); } catch { /* unreadable/binary files are outside the text scan */ } }
if (findings.length) {
  console.error(`Potential secrets found:\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`Secret scan passed (${files.length} text files).`);
