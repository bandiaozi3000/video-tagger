#!/usr/bin/env node
/**
 * 语义检索质量评估脚本
 * 逐条读取 golden set → 打真后端 /api/search → 算 Recall@K / MRR / 空返回正确率。
 *
 * 用法：
 *   node docs/eval/run-search-eval.js [golden.json]
 *   环境变量：BASE_URL（默认 http://localhost:8080） K（默认 10）
 *
 * 前提：后端已起、已配 EMBEDDING_*（否则 semanticEnabled=false，语义评估无效，脚本会警告）。
 * 匹配规则：expected 子串出现在结果 title / mediaTitle / tag / note 任一即算命中（大小写不敏感）。
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const K = parseInt(process.env.K || '10', 10);
const goldenFile = process.argv[2] || path.join(__dirname, 'search-golden-set.json');

function matches(r, expect) {
  const hay = [r.title, r.mediaTitle, r.tag, r.note].filter(Boolean).join(' | ');
  return hay.toLowerCase().includes(String(expect).toLowerCase());
}

async function fetchSearch(query, dim) {
  const sp = new URLSearchParams({ q: query, dim: dim || 'mixed', limit: String(K) });
  const resp = await fetch(`${BASE}/api/search?${sp}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for q=${query}`);
  return resp.json();
}

async function main() {
  const golden = JSON.parse(fs.readFileSync(goldenFile, 'utf8'));
  if (!golden.items || !golden.items.length) {
    console.error('golden set 为空，请先填充 docs/eval/search-golden-set.json');
    process.exit(1);
  }

  const rows = [];
  let semanticAll = true;
  for (const it of golden.items) {
    let data;
    try {
      data = await fetchSearch(it.query, it.dim);
    } catch (e) {
      console.error(`查询失败：${it.query} — ${e.message}`);
      continue;
    }
    const list = data.results || [];
    if (data.semanticEnabled !== undefined && !data.semanticEnabled) semanticAll = false;

    let firstHit = -1, matched = 0;
    for (const exp of it.expected || []) {
      const idx = list.findIndex(r => matches(r, exp));
      if (idx >= 0) {
        matched++;
        if (firstHit < 0 || idx < firstHit) firstHit = idx;
      }
    }
    const gotEmpty = list.length === 0;
    const isNegative = !!it.shouldEmpty;
    const ok = isNegative ? gotEmpty : (it.expected.length > 0 && matched === it.expected.length);
    const recall = isNegative ? (gotEmpty ? 1 : 0)
      : (it.expected.length ? matched / it.expected.length : 0);

    rows.push({
      query: it.query, dim: it.dim || 'mixed', category: it.category || '',
      semantic: data.semanticEnabled, returned: list.length,
      expected: (it.expected || []).join(' / ') || (isNegative ? '(应空)' : ''),
      recall, mrr: firstHit >= 0 ? 1 / (firstHit + 1) : 0, ok,
      top: list.slice(0, 5).map(r =>
        `${r.entityType}:${(r.title || '').slice(0, 28)}${r.tag ? ' #' + r.tag : ''}${r.mediaTitle ? ` [${r.mediaTitle.slice(0, 16)}]` : ''}`
      ).join('\n        ')
    });
  }

  if (rows.length === 0) { console.error('无有效评测条目'); process.exit(1); }

  const normalRows = rows.filter((_, i) => !golden.items[i].shouldEmpty);
  const negRows = rows.filter((_, i) => golden.items[i].shouldEmpty);
  const avgRecall = normalRows.length ? normalRows.reduce((s, r) => s + r.recall, 0) / normalRows.length : 0;
  const avgMrr = normalRows.length ? normalRows.reduce((s, r) => s + r.mrr, 0) / normalRows.length : 0;
  const negOk = negRows.filter(r => r.ok).length;
  const negRate = negRows.length ? negOk / negRows.length : 0;

  console.log('='.repeat(100));
  console.log('语义检索质量评估报告');
  console.log(`数据源: ${BASE}    K=${K}    golden 条目: ${rows.length}（正常 ${normalRows.length} / 负样本 ${negRows.length}）`);
  console.log(`semanticEnabled 全为 true: ${semanticAll ? '是' : '否 ' + (semanticAll === false ? '（⚠️ 存在非语义结果，评估仅供参考）' : '')}`);
  console.log('-'.repeat(100));
  console.log('汇总指标:');
  console.log(`  Recall@${K}（正常条目平均）  : ${(avgRecall * 100).toFixed(1)}%`);
  console.log(`  MRR（正常条目平均）        : ${avgMrr.toFixed(3)}`);
  console.log(`  空返回正确率（负样本）     : ${(negRate * 100).toFixed(1)}%  (${negOk}/${negRows.length})`);
  console.log('-'.repeat(100));
  console.log('逐条明细:');
  for (const r of rows) {
    console.log(`\n[${r.ok ? 'PASS' : 'FAIL'}] ${r.category || ''} | ${r.query} (${r.dim})`);
    console.log(`  期望: ${r.expected}    返回: ${r.returned} 条 | recall=${(r.recall * 100).toFixed(0)}% mrr=${r.mrr.toFixed(2)}`);
    console.log(`  top5:\n        ${r.top || '(空)'}`);
  }
  console.log('='.repeat(100));
}

main().catch(e => { console.error(e); process.exit(1); });
