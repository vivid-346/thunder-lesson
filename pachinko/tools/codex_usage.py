#!/usr/bin/env python3
"""Codex（ChatGPT プラン）の利用枠の使用率を、最新のセッションログから表示します。
使い方: python3 pachinko/tools/codex_usage.py
報告ルール: 20% / 40% / 60% / 80% を超えるたびに報告し、80% を超えたら作業を止めてユーザーに確認する。
"""
import glob, json, os, datetime

logs = sorted(glob.glob(os.path.expanduser('~/.codex/sessions/*/*/*/*.jsonl')), key=os.path.getmtime)
rl = None
for path in reversed(logs):
    for line in open(path, encoding='utf-8'):
        if '"rate_limits"' not in line:
            continue
        def find(o):
            if isinstance(o, dict):
                if 'rate_limits' in o and isinstance(o['rate_limits'], dict):
                    return o['rate_limits']
                for v in o.values():
                    r = find(v)
                    if r: return r
            elif isinstance(o, list):
                for v in o:
                    r = find(v)
                    if r: return r
        r = find(json.loads(line))
        if r: rl = r
    if rl: break
if not rl:
    print('使用率の情報が見つかりません（Codex をまだ実行していない可能性があります）'); raise SystemExit(1)
p = rl.get('primary') or {}
used = p.get('used_percent'); win = p.get('window_minutes'); reset = p.get('resets_at')
jst = datetime.timezone(datetime.timedelta(hours=9))
reset_s = datetime.datetime.fromtimestamp(reset, jst).strftime('%m/%d %H:%M') if reset else '不明'
credits = rl.get('credits') or {}
print(f"プラン: {rl.get('plan_type')}  使用率: {used}%  枠の期間: {round(win / 1440, 1) if win else '?'}日  リセット: {reset_s}（日本時間）")
print(f"有料クレジット: {'あり' if credits.get('has_credits') else 'なし'}（残高 {credits.get('balance')}）")
level = next((m for m in (80, 60, 40, 20) if used is not None and used >= m), 0)
print(f"報告ライン: {level}% 到達" if level else "報告ライン: 20% 未満")
if used is not None and used >= 80:
    print('⚠ 80% を超えました。作業を止めてユーザーに確認してください。')
