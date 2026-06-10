// Static endpoint extractor: parses NestJS controllers for @Controller base path
// + method decorators (@Get/@Post/@Put/@Patch/@Delete) and emits a markdown table.
// Verifiable, no app run required. One-shot — safe to delete after.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'backend', 'src');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.controller.ts') && !entry.name.endsWith('.spec.ts')) acc.push(full);
  }
  return acc;
}

const VERB = /@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)?/;
const CTRL = /@Controller\(\s*(?:'([^']*)'|"([^"]*)"|\{[^}]*path:\s*'([^']*)')?/;
// Member data controllers use a custom decorator with a default base path.
const MEMBER_CTRL = /@MemberDataController\(\s*(?:'([^']*)')?/;

const files = walk(srcDir).sort();
let total = 0;
const sections = [];

for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let base = '';
  const routes = [];
  for (let i = 0; i < lines.length; i++) {
    const c = lines[i].match(CTRL);
    if (c && base === '') base = (c[1] || c[2] || c[3] || '').replace(/^\/|\/$/g, '');
    const mc = lines[i].match(MEMBER_CTRL);
    if (mc && base === '') base = (mc[1] || 'member/v1').replace(/^\/|\/$/g, '');
    const v = lines[i].match(VERB);
    if (v) {
      const verb = v[1].toUpperCase();
      const sub = (v[2] || v[3] || v[4] || '').replace(/^\//, '');
      // find next method name (skip other decorator lines)
      let name = '';
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
        const m = lines[j].match(/^\s*(?:async\s+)?([a-zA-Z0-9_]+)\s*\(/);
        if (m && !lines[j].trim().startsWith('@')) { name = m[1]; break; }
      }
      const full = '/' + [base, sub].filter(Boolean).join('/');
      routes.push({ verb, full, name });
      total++;
    }
  }
  if (routes.length) {
    const isMember = base.startsWith('member/v1');
    sections.push({ rel, base, routes, isMember });
  }
}

let md = '# MuscleX — Backend API Reference\n\n';
md += `> Auto-extracted from ${files.length} NestJS controllers on 2026-06-04 (static parse of\n`;
md += '> `@Controller` + verb decorators — no app run). **' + total + ' routes total.**\n';
md += '> Path prefix `api/v1` is baked into each `@Controller`. Member routes (`/api/v1/member/*`)\n';
md += '> authenticate with the **member JWT**; all others use the staff JWT + `JwtAuthGuard` +\n';
md += '> `TenantMiddleware` (except `auth/*` and `health`). Request/response DTOs live beside each\n';
md += '> controller. This table is generated — regenerate rather than hand-edit.\n\n';

const staff = sections.filter((s) => !s.isMember);
const member = sections.filter((s) => s.isMember);

function render(list, title) {
  let out = `\n## ${title}\n\n`;
  for (const s of list) {
    out += `### \`${s.base ? '/' + s.base : '(root)'}\` — [${s.rel}](${s.rel})\n\n`;
    out += '| Method | Path | Handler |\n|---|---|---|\n';
    for (const r of s.routes) out += `| ${r.verb} | \`${r.full}\` | ${r.name || '—'} |\n`;
    out += '\n';
  }
  return out;
}

md += render(staff, 'Staff / Admin API');
md += render(member, 'Member BFF API (member JWT)');

fs.writeFileSync(path.join(root, 'docs', 'API_REFERENCE.md'), md);
console.log(`Wrote docs/API_REFERENCE.md — ${total} routes across ${sections.length} controllers (${member.length} member).`);
