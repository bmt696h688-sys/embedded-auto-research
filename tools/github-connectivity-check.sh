#!/usr/bin/env bash
# GitHub 连通性一键复测(2026-09-30)
# 用途: GitHub 又打不开时,在 Git Bash 里运行:
#   bash tools/github-connectivity-check.sh           # 体检:各候选IP测速+当前hosts状态
#   bash tools/github-connectivity-check.sh --set IP  # 把 github.com 换成测出的最快IP
# 原理: 本机对 GitHub 的干扰是"间歇性丢包"(DNS正常、部分IP段被定向丢包限速),
#       hosts 固定当前最快的IP + SSH走443端口可绕开大部分干扰。
set -u
HOSTS=/c/Windows/System32/drivers/etc/hosts
CANDIDATES="20.205.243.166 140.82.113.4 140.82.121.4 140.82.112.4 140.82.116.4"

# ---- --set IP: 更换 hosts 中 github.com 的固定IP(自动备份) ----
if [ "${1:-}" = "--set" ]; then
  IP="${2:?用法: bash $0 --set <IP地址>,IP 取下面体检输出的最快者}"
  cp "$HOSTS" "$HOSTS.bak-$(date +%Y%m%d%H%M%S)"
  grep -vE '^[0-9.]+[[:space:]]+github\.com([[:space:]]|$)' "$HOSTS" > "$HOSTS.tmp"
  echo "$IP github.com" >> "$HOSTS.tmp"
  mv "$HOSTS.tmp" "$HOSTS"
  ipconfig //flushdns >/dev/null 2>&1
  echo "已把 github.com 固定到 $IP (原 hosts 已带时间戳备份)"
  exit 0
fi

# ---- 默认: 体检 ----
echo "== github.com 候选IP实测 (HTTP状态 耗时):"
BEST=""; BEST_T=999
for ip in $CANDIDATES; do
  r=$(curl -sS -o /dev/null --connect-timeout 4 --max-time 8 -w "%{http_code} %{time_total}s" --resolve github.com:443:$ip https://github.com 2>/dev/null) || r="000 失败"
  echo "  $ip -> $r"
  code=${r%% *}; t=${r#* }; t=${t%s}
  if [ "$code" = "200" ]; then
    ok=$(awk "BEGIN{print ($t < $BEST_T) ? 1 : 0}")
    [ "$ok" = "1" ] && { BEST_T=$t; BEST=$ip; }
  fi
done
echo "== 稳定子域直连(默认DNS,通常不受影响):"
for u in https://api.github.com https://raw.githubusercontent.com; do
  r=$(curl -sS -o /dev/null --connect-timeout 4 --max-time 8 -w "%{http_code} %{time_total}s" "$u" 2>/dev/null) || r="失败"
  echo "  $u -> $r"
done
echo "== SSH over 443 可达性:"
SSHOUT=$(timeout 8 ssh -p 443 -o StrictHostKeyChecking=accept-new -o BatchMode=yes -T git@ssh.github.com 2>&1 || true)
case "$SSHOUT" in
  *publickey*|*authenticated*) echo "  ssh.github.com:443 服务可达 ✓ (git操作通道正常)";;
  *) echo "  ssh.github.com:443 异常: ${SSHOUT:-无响应}";;
esac
echo
CUR=$(grep -E '^[0-9.]+[[:space:]]+github\.com' "$HOSTS" | awk '{print $1}' | tr '\n' ' ')
echo "hosts 中 github.com 当前固定为: ${CUR:-未固定(走默认DNS)}"
[ -n "$BEST" ] && echo "本次实测最快IP: $BEST (${BEST_T}s) —— 更换命令: bash $0 --set $BEST"
echo "提示: 干扰是间歇性的,单次超时属正常,等1-2分钟重试;git操作请走SSH(不受此影响)。"
