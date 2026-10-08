#!/usr/bin/env node
// Skill 质量闸门：校验仓库内每个 Skill 的元信息、体积、路径引用与安装副本一致性。
// 布局：单 Skill 仓库，每个 Skill 是仓库根下的一个目录（内含 SKILL.md）。
// 用法：node scripts/check-skill.mjs        检查全部
//       node scripts/check-skill.mjs <名>   只检查某个 Skill
// 无第三方依赖，只用 Node 标准库。

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SKILLS_DIR = repoRoot;                    // 仓库根就是 Skill 的父目录
const INSTALL_DIR = path.join(repoRoot, '.agents', 'skills');
const IGNORED_DIRS = ['.agents', '.git', 'node_modules', 'docs'];

const MAX_SKILL_LINES = 160;      // 入口文件只做路由，细则放 references/
const MAX_NAME_CHARS = 64;
const MAX_DESC_CHARS = 1024;
const MAX_DESC_BYTES = 1024;      // 有的运行时按字节截断，中文一字三字节
const BANNED_WORDS = [/TODO/, /FIXME/, /\bTBD\b/, /待补充/, /占位/];
// 触发词：description 里删掉任何一个都会降低宿主命中率，且自己看不出来
const REQUIRED_TRIGGERS = ['图片', '整理', '水印', '干扰', 'extract', 'transcribe', 'OCR', 'screenshot'];
const RESOURCE_DIRS = ['references', 'assets', 'scripts', 'examples'];

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return null;
  const fields = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = /^([A-Za-z0-9][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (!kv) return { bad: line, fields };
    fields.set(kv[1], kv[2].replace(/^["']|["']$/g, '').trim());
  }
  return { fields };
}

function walkFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function checkSkill(dir) {
  const name = path.basename(dir);
  const skillPath = path.join(dir, 'SKILL.md');
  const rel = name;

  if (!existsSync(skillPath)) {
    err(rel, '缺少 SKILL.md');
    return;
  }
  // 单 Skill 仓库的说明文档可以放在仓库根，也可以放在 Skill 目录里
  if (!existsSync(path.join(dir, 'README.md')) && !existsSync(path.join(repoRoot, 'README.md'))) {
    warn(rel, '缺少 README.md（给人看的说明）');
  }

  const raw = readFileSync(skillPath, 'utf8');
  const fm = parseFrontmatter(raw);
  if (!fm) return void err(rel, 'SKILL.md 必须以 YAML frontmatter 开头（--- 分隔）');
  if (fm.bad) return void err(rel, `frontmatter 只支持单行 "键: 值"，无法解析：${fm.bad}`);

  const fields = fm.fields;
  const declaredName = fields.get('name');
  const description = fields.get('description');

  if (!declaredName) err(rel, 'frontmatter 缺少 name');
  else if (declaredName !== name) err(rel, `name "${declaredName}" 与目录名 "${name}" 不一致`);
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(declaredName)) err(rel, 'name 必须是小写字母、数字与连字符（hyphen-case）');
  else if (declaredName.length > MAX_NAME_CHARS) err(rel, `name ${declaredName.length} 字符，上限 ${MAX_NAME_CHARS}`);

  for (const key of fields.keys()) {
    if (key !== 'name' && key !== 'description') {
      warn(rel, `frontmatter 含额外字段 "${key}"，用前确认它属于开放规范的可选字段，不要引入特定 Agent 的专有字段`);
    }
  }

  if (!description) err(rel, 'frontmatter 缺少 description');
  else {
    if (description.length > MAX_DESC_CHARS) err(rel, `description ${description.length} 字符，上限 ${MAX_DESC_CHARS}`);
    const bytes = Buffer.byteLength(description, 'utf8');
    if (bytes > MAX_DESC_BYTES) err(rel, `description ${bytes} 字节，上限 ${MAX_DESC_BYTES}（中文按 3 字节算）`);
    if (!description.includes('当') && !/[Uu]se when/.test(description)) {
      warn(rel, 'description 建议写成「当……时使用」的触发条件句式');
    }
    for (const trigger of REQUIRED_TRIGGERS) {
      const hit = /^[a-z]/i.test(trigger)
        ? new RegExp(trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(description)
        : description.includes(trigger);
      if (!hit) err(rel, `description 丢失触发词 "${trigger}"`);
    }
  }

  const lines = raw.trimEnd().split(/\r?\n/);
  if (lines.length > MAX_SKILL_LINES) err(rel, `SKILL.md ${lines.length} 行，上限 ${MAX_SKILL_LINES} 行——把细则下沉到 references/`);

  for (const re of BANNED_WORDS) {
    const hit = lines.findIndex((l) => re.test(l));
    if (hit >= 0) err(rel, `第 ${hit + 1} 行含未完成标记 ${re}`);
  }

  // SKILL.md 里写到的包内路径必须真实存在（防止改了文件名留下死链）
  const cited = new Set();
  const citedRe = /`((?:references|assets|scripts|examples)\/[^`\s]+)`/g;
  let m;
  while ((m = citedRe.exec(raw))) cited.add(m[1].split('#')[0]);
  for (const ref of cited) {
    if (!existsSync(path.join(dir, ref.split('/')[0]))) err(rel, `引用的目录不存在：${ref.split('/')[0]}/`);
    else if (!existsSync(path.join(dir, ...ref.split('/')))) err(rel, `SKILL.md 引用了不存在的文件：${ref}`);
  }

  // 反向检查：随包发布的资源没被入口提到，就是永远不会被加载的死重量
  for (const sub of RESOURCE_DIRS) {
    const subDir = path.join(dir, sub);
    if (!existsSync(subDir)) continue;
    for (const file of walkFiles(subDir)) {
      const relPath = path.relative(dir, file).split(path.sep).join('/');
      if (!raw.includes(relPath)) warn(rel, `${relPath} 未被 SKILL.md 提到，Agent 不会知道去读它`);
    }
  }

  // 安装副本必须与源一致，否则改动不生效
  const installed = path.join(INSTALL_DIR, name);
  if (!existsSync(installed)) warn(rel, `未安装到 .agents/skills/${name}/，本地 Codex 会话无法发现`);
  else {
    const sources = walkFiles(dir);
    for (const file of sources) {
      const relPath = path.relative(dir, file);
      const target = path.join(installed, relPath);
      if (!existsSync(target)) err(rel, `安装副本缺文件：.agents/skills/${name}/${relPath.split(path.sep).join('/')}`);
      else if (readFileSync(target).compare(readFileSync(file)) !== 0) {
        err(rel, `安装副本与源不一致：${relPath.split(path.sep).join('/')}`);
      }
    }
    // 反向：安装副本里有源里已经没有的文件（改名或删文件后留下的旧副本）
    const expected = new Set(sources.map((f) => path.relative(dir, f)));
    for (const file of walkFiles(installed)) {
      const relPath = path.relative(installed, file);
      if (!expected.has(relPath)) {
        err(rel, `安装副本有多余文件：.agents/skills/${name}/${relPath.split(path.sep).join('/')}`);
      }
    }
  }
}

const only = process.argv[2];
if (!existsSync(SKILLS_DIR)) {
  console.error(`找不到 ${SKILLS_DIR}`);
  process.exit(1);
}
// 一个目录是 Skill，当且仅当它里面有 SKILL.md
const targets = readdirSync(SKILLS_DIR)
  .filter((n) => !n.startsWith('.') && !IGNORED_DIRS.includes(n))
  .map((n) => path.join(SKILLS_DIR, n))
  .filter((full) => statSync(full).isDirectory())
  .filter((full) => existsSync(path.join(full, 'SKILL.md')))
  .filter((full) => !only || path.basename(full) === only);

if (!targets.length) {
  console.error(only ? `仓库根下没有名为 ${only} 的 Skill 目录（需含 SKILL.md）` : '仓库根下没有 Skill 目录（需含 SKILL.md）');
  process.exit(1);
}
for (const dir of targets) checkSkill(dir);

for (const skill of targets) {
  const name = path.basename(skill);
  const raw = readFileSync(path.join(skill, 'SKILL.md'), 'utf8');
  const fm = parseFrontmatter(raw);
  const desc = fm?.fields?.get('description') ?? '';
  console.log(
    `${name}  SKILL.md ${raw.trimEnd().split(/\r?\n/).length}/${MAX_SKILL_LINES} 行` +
      `  description ${desc.length} 字符 / ${Buffer.byteLength(desc, 'utf8')} 字节`,
  );
}
console.log('');
for (const w of warnings) console.log(`  WARN  ${w}`);
for (const e of errors) console.log(`  FAIL  ${e}`);
console.log(
  errors.length
    ? `\n未通过：${errors.length} 个错误，${warnings.length} 个警告。`
    : `\n通过：${targets.length} 个 Skill，${warnings.length} 个警告。`,
);
process.exit(errors.length ? 1 : 0);
