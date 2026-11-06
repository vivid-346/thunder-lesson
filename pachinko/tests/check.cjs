// P THUNDER 雷牙 の自動チェック
//   node tests/check.cjs          … 全項目（読み込み・物理・当り方 A/B/C/D/F/G）
//   node tests/check.cjs --quick  … 読み込み・物理・当り方 A のみ
// 前提：Playwright と Chromium が使えること（require('playwright')）、npm install 済み（three@0.160.0）。
// CDN（cdn.jsdelivr.net）へは出ず、node_modules/three を返します。結果画像は tests/out/ に保存します。
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), THREE_DIR = path.join(ROOT, 'node_modules', 'three'), OUT = path.join(__dirname, 'out');
const quick = process.argv.includes('--quick');
const patterns = quick ? ['A'] : ['A', 'B', 'C', 'D', 'F', 'G'];
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'OK  ' : 'NG  '} ${name}  ${detail}`); };

async function open(browser, errors) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/(.*)/, r => r.fulfill({ path: path.join(THREE_DIR, r.request().url().split('three@0.160.0/')[1]), contentType: 'application/javascript' }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => window.__pachi && window.__sim, null, { timeout: 30000 });
  return p;
}

(async () => {
  if (!fs.existsSync(THREE_DIR)) { console.error('node_modules/three がありません。pachinko で npm install を実行してください。'); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

  // 1. 読み込み
  let errors = [];
  let p = await open(browser, errors);
  await p.waitForTimeout(1500);
  ok('読み込み（エラーなし）', errors.length === 0, errors.slice(0, 3).join(' / ') || 'ページエラー 0 件');

  // 2. 物理：ヘソ入賞率と右打ち
  const sim = await p.evaluate(() => ({ heso: __sim(65, 300).heso / 3, den: __sim(96, 150, { den: true }).denchu, att: __sim(96, 150, { att: true }).attacker }));
  ok('左打ちヘソ入賞率（ハンドル65で6〜15%）', sim.heso >= 6 && sim.heso <= 15, `${sim.heso.toFixed(1)}%`);
  ok('右打ち電チュー（ハンドル96で93%以上）', sim.den >= 140, `${sim.den}/150`);
  ok('右打ちアタッカー（ハンドル96で85%以上）', sim.att >= 128, `${sim.att}/150`);
  await p.close();

  // 3. 当り方ごとに、大当り → ラウンド → 終了まで進むか
  for (const pat of patterns) {
    errors = [];
    p = await open(browser, errors);
    await p.click('#startBtn');
    await p.evaluate(pat => {
      const P = __pachi; P.SPEC.roundTime = 0.4; P.state.firing = false; P.state.forcePattern = pat; P.state.forceNext = true;
      P.onEntry('heso', { x: 0, y: -4 });
    }, pat);
    const t0 = Date.now(); let hit = false, done = false, shot = false;
    while (Date.now() - t0 < 120000) {
      await p.waitForTimeout(400);
      const st = await p.evaluate(() => ({ hit: __pachi.stats.hits > 0, lhit: __pachi.L.hit, push: !!__pachi.L.push, sp: __pachi.state.spinning, jp: __pachi.state.jackpot }));
      if (st.push) await p.keyboard.press('Space');
      if (st.lhit && !shot) { shot = true; await p.waitForTimeout(600); const d = await p.evaluate(() => __pachi.lcdCanvas.toDataURL('image/jpeg', 0.8)); fs.writeFileSync(path.join(OUT, `hit_${pat}.jpg`), Buffer.from(d.split(',')[1], 'base64')); }
      if (st.hit) hit = true;
      if (hit && !st.sp && !st.jp) { done = true; break; }
    }
    ok(`当り方 ${pat}（大当り → ラウンド → 終了）`, done && errors.length === 0, `${((Date.now() - t0) / 1000).toFixed(0)}秒${errors.length ? ' / ' + errors[0] : ''}${!hit ? ' / 大当りにならない' : !done ? ' / 終わらない' : ''}`);
    await p.close();
  }
  await browser.close();
  const ng = results.filter(r => !r.pass).length;
  console.log(`\n結果：${results.length - ng}/${results.length} 合格${ng ? `（不合格 ${ng} 件）` : ''}。画像：tests/out/`);
  process.exit(ng ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
