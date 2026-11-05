# P妖怪召喚 ドキドキRUSH — AI向け引き継ぎメモ

`index.html` は1ファイル完結の3Dパチンコ試作機です（HTML/CSS/JS、Three.js r160 を CDN から import map で読み込み）。
妖怪テーマのオリジナル台で、既存作品のキャラクター・ロゴ・楽曲は使っていません。

## 起動

```bash
cd pachinko
python3 -m http.server 8000   # → http://localhost:8000/
```

ES Modules を使うため `file://` で直接開くと動きません。CDN（cdn.jsdelivr.net）への接続が必要です。

## スペック（`SPEC` 定数、section 1）

| 項目 | 値 | コード |
| --- | --- | --- |
| 通常時大当り | 1/319.9 | `SPEC.normalProb` |
| RUSH突入率 | 50% | `SPEC.rushRate` |
| RUSH | ST16回・1/9.9（継続率 約81.8%） | `SPEC.stSpins`, `SPEC.rushProb` |
| 出玉 | 10R × 10C × 15発 | `SPEC.rounds`, `roundCount`, `payout` |
| 賞球 | ヘソ3 / 電チュー1 | `SPEC.hesoPay`, `denchuPay` |
| 保留上限 | 4 | `SPEC.holdMax` |

抽選はヘソ入賞時に実行します（`lottery()`）。保留色、リーチ、SPリーチ、群予告、カットインもここで決まり、変動時に `runSpin()` が消化します。保留中にモードが変わった場合は、変動開始時に引き直します。

## コード構成（`index.html` 内の section 番号）

1. スペック：`SPEC`、継続率 `CONT_RATE`
2. ユーティリティ：`rand`, `pickW`, `sleep` など
3. サウンド：`Snd`（WebAudioで効果音とBGMを合成）、`Snd.cut()` でプチュン時の無音化、`say()` で音声読み上げ
4. 盤面物理：盤面平面上の2D物理。円形外レール、釘（グリッドハッシュ）、線分 `seg()`（`active` で開閉切替）、風車
   - センサー：ヘソ、電チュー、アタッカー、ワープ（確率 `WARP_P`）、アウト
   - `window.__sim(power, n, {den, att})` で入賞率をヘッドレス計測できます
5. Three.js シーン：盤面アート（Canvas）、釘と玉（InstancedMesh）、液晶、役物（召喚メダル）、ヘソ・電チュー・アタッカー、パーティクル、召喚エフェクト `SU`、虹リング、群予告オブジェクト。ブルームは UnrealBloomPass
6. 液晶：1024×768 の Canvas を毎フレーム描画してテクスチャ化。リール `reels` / `stopReel()`、背景テーマ `L.bg`（normal / reach / sp / rush / jackpot）、テロップ `caption()`、保留アイコン
7. ゲーム状態・抽選：`state`, `stats`, `lottery()`, `decideSymbols()`, 入賞処理 `onEntry()`, 先読み演出 `onHoldEffect()`
8. 演出ヘルパー：カメラ揺れ `shakeCam`、CSS揺れ `cssShake`、`edgeFlash`、`whiteFlash`、大文字テロップ `showBig`、PUSHボタン待ち `waitPush`、枠ランプ
9. 変動シーケンス（async）：`runSpin` → `groupNotice` / `spReach` → `puchun` → `bigHit` → `runRounds` → 昇格演出 → RUSH、`endSpin`（ST終了処理）
10. 入力・HUD：ボタン、キーボード（F / ↑↓ / ←→ / Space・Enter）、`updateHUD`
11. メインループ：物理（1/480秒サブステップ）、発射（0.6秒間隔）、電サポ、カメラ、描画

## 調整のポイント

- ヘソ入賞率：命釘の位置（`buildNails` 末尾の手動配置）、`WARP_P`、左ルートの `seg(-8.2, -2.05, -3.4, -2.75)`。現状、左打ちのハンドル50〜55でおよそ9%
- 右打ちは、ハンドル96で電チュー・アタッカーとも約100%入賞
- 演出の出現率：`lottery()` 内の配列（保留色の重み、リーチ・SP・群・カットインの確率）
- テスト用：HUDの「デモ 1/30」「次回 大当り」。コンソールでは `__pachi`（state, stats, SPEC, onEntry など）を操作できます

## 既知の制約・未確認の点

- 実機GPUでのフレームレートは未計測（スマホでは pixelRatio を最大1.5に制限）
- 振動（`navigator.vibrate`）と読み上げはブラウザ依存
- 元の依頼文は大当り演出の途中で切れていたため、大当り後の流れ（ラウンド → RUSH確定 / 昇格PUSH）は推測で実装しています
