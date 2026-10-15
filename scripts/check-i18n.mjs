#!/usr/bin/env node
// 文案自检。tsc 拦不住 i18n 的错（next-intl 的 t("...") 是字符串参数，键写错也能编译过），
// 所以用这个脚本兜住三件最容易忘的事：
//
//   1. messages/zh.json 和 messages/en.json 的键必须完全一致（少一个键，那个语言就会在
//      运行时直接抛错 / 显示成键名）。
//   2. 同一个键在两种语言里的 ICU 占位符（{name} 之类）和富文本标签（<link>）必须一致，
//      否则换到那个语言就会缺参数或漏标签。
//   3. 代码里 t("xxx") 用到的键都得在两份文案里存在；反过来，没人用的键要么是漏了调用，
//      要么是删代码时忘了清理（这条只警告，不算失败）。
//
// 用法：node scripts/check-i18n.mjs
//
// 说明：这里只扫 `t("key")` / `t.rich("key")` 这种字面量写法。像
// `t(\`sort.${o.id}\`)` 这种动态键扫不到，会被当成"未使用"报出来，属于预期噪音。

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MESSAGES_DIR = join(ROOT, "messages");
const SRC_DIR = join(ROOT, "src");

const LOCALES = readdirSync(MESSAGES_DIR)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.replace(/\.json$/, ""));

const catalogs = new Map(
  LOCALES.map((locale) => [locale, JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), "utf8"))])
);

/** 把嵌套对象拍平成 "a.b.c" -> "文案" */
function flatten(obj, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, path, out);
    else out.set(path, String(value));
  }
  return out;
}

const flat = new Map([...catalogs].map(([locale, obj]) => [locale, flatten(obj)]));

const errors = [];
const warnings = [];

// ---- 1. 键集合必须一致 ----
const [base, ...others] = LOCALES;
for (const locale of others) {
  const baseKeys = new Set(flat.get(base).keys());
  const otherKeys = new Set(flat.get(locale).keys());
  for (const key of baseKeys) {
    if (!otherKeys.has(key)) errors.push(`messages/${locale}.json 缺少键：${key}`);
  }
  for (const key of otherKeys) {
    if (!baseKeys.has(key)) errors.push(`messages/${base}.json 缺少键：${key}`);
  }
}

// ---- 2. 占位符与富文本标签必须一致 ----
const placeholderRe = /\{(\w+)[^}]*\}/g;
const tagRe = /<(\w+)>/g;

function tokensOf(text) {
  const values = new Set();
  for (const m of text.matchAll(placeholderRe)) values.add(`{${m[1]}}`);
  for (const m of text.matchAll(tagRe)) values.add(`<${m[1]}>`);
  return values;
}

for (const key of flat.get(base).keys()) {
  const sets = LOCALES.map((locale) => ({ locale, tokens: tokensOf(flat.get(locale).get(key) ?? "") }));
  const reference = sets[0];
  for (const { locale, tokens } of sets.slice(1)) {
    const missing = [...reference.tokens].filter((token) => !tokens.has(token));
    const extra = [...tokens].filter((token) => !reference.tokens.has(token));
    if (missing.length || extra.length) {
      errors.push(
        `${key}：占位符/标签在 ${reference.locale} 和 ${locale} 之间不一致` +
          (missing.length ? `（${locale} 缺 ${missing.join(" ")}）` : "") +
          (extra.length ? `（${locale} 多 ${extra.join(" ")}）` : "")
      );
    }
  }
}

// ---- 3. 代码里用到的键 vs 文案里定义的键 ----
function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(full)) files.push(full);
  }
  return files;
}

// useTranslations("ns") / getTranslations("ns") / getTranslations({ namespace: "ns" })
const nsRe = /(?:useTranslations|getTranslations)\(\s*(?:"([^"]+)"|\{[^}]*namespace:\s*"([^"]+)")/g;
// 变量名 -> 命名空间，例如 const t = useTranslations("submit")
const bindingRe = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([^"]+)"|\{[^}]*namespace:\s*"([^"]+)")/g;

const usedKeys = new Set();

for (const file of walk(SRC_DIR)) {
  const src = readFileSync(file, "utf8");
  if (!nsRe.test(src)) continue;
  nsRe.lastIndex = 0;

  const bindings = new Map();
  for (const m of src.matchAll(bindingRe)) bindings.set(m[1], m[2] ?? m[3]);
  if (bindings.size === 0) continue;

  for (const [name, ns] of bindings) {
    const callRe = new RegExp(`\\b${name}(?:\\.rich|\\.markup|\\.raw)?\\(\\s*"([^"\`]+)"`, "g");
    for (const m of src.matchAll(callRe)) {
      const key = `${ns}.${m[1]}`;
      usedKeys.add(key);
      for (const locale of LOCALES) {
        if (!flat.get(locale).has(key)) {
          errors.push(`${relative(ROOT, file)} 用了 ${name}("${m[1]}")，但 messages/${locale}.json 里没有 ${key}`);
        }
      }
    }
  }
}

for (const key of flat.get(base).keys()) {
  if (!usedKeys.has(key)) warnings.push(`没有代码用到：${key}`);
}

if (warnings.length) {
  console.log(`ℹ️  ${warnings.length} 个键没被字面量调用命中（动态键如 t(\`sort.\${id}\`) 会落在这里）：`);
  for (const line of warnings) console.log(`   · ${line}`);
  console.log("");
}

if (errors.length) {
  console.error(`❌ i18n 检查失败，${errors.length} 个问题：`);
  for (const line of errors) console.error(`   · ${line}`);
  process.exit(1);
}

console.log(`✅ i18n 检查通过（${LOCALES.join(" / ")}，共 ${flat.get(base).size} 个键）`);
