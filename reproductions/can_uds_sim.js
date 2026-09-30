#!/usr/bin/env node
/**
 * 实验 3: CAN 总线 / ISO-TP / UDS 诊断协议攻击仿真
 * ==================================================
 * 对应知识库: knowledge/04-automotive-buses + knowledge/05-automotive-ecu-ivi
 * 规范锚点: ISO 11898 (CAN 仲裁/错误计数), ISO 15765-2 (ISO-TP), ISO 14229 (UDS)
 *
 * 零依赖 Node.js 协议级仿真,覆盖五类真实攻击场景:
 *   Demo 1 — CAN 仲裁: 低 ID 赢 → 泛洪低优先级 ID = 对高 ID 的定向饥饿
 *   Demo 2 — bus-off 攻击 (Cho & Shin, CCS'16): 错误计数器机制武器化,
 *            选择性把单个 ECU 踢下总线 (定向 DoS)
 *   Demo 3 — ISO-TP 分帧: SF/FF/CF 往返 (UDS 的传输层)
 *   Demo 4 — UDS 正常流程: 会话(0x10)→SecurityAccess(0x27)→读 DID(0x22)
 *   Demo 5 — 攻击场景:
 *            A. 未认证读敏感 DID → NRC 0x33 (协议防线成立)
 *            B. 固件逆向提取 seed-key 算法 → 直接算出 key → 解锁 (安全=算法保密)
 *            C. ECU 复位后种子重复 → 重放旧 key (弱 PRNG 种子管理)
 *            D. 功能寻址 0x7DF 广播 → 枚举全网关 ECU
 *
 * 简化声明(诚实边界): 无位填充/无 ACK 时序/错误计数器按 +8 每次错误建模,
 * 响应方向不做流控等待; 方法结论(仲裁/计数器/会话/认证逻辑)与真实机制同构。
 *
 * 运行: node can_uds_sim.js   (确定性,PRNG 为固定种子的 LCG)
 */

'use strict';

// ---------- 断言工具 ----------
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log(`    [PASS] ${label}`); }
  else { fail++; console.log(`    [FAIL] ${label}  <-- 请检查仿真实现`); }
}
function h1(t) { console.log(`\n${'='.repeat(72)}\n${t}\n${'='.repeat(72)}`); }
function h2(t) { console.log(`\n-- ${t}`); }
const hex = (a) => a.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

// ---------- ISO-15765-2 (ISO-TP) ----------
function buildIsoTpFrames(payload) {
  if (payload.length <= 7) return [[payload.length, ...payload]];
  const out = [];
  const ff = [0x10 | (payload.length >> 8), payload.length & 0xFF, ...payload.slice(0, 6)];
  out.push(ff);
  let seq = 1, off = 6;
  while (off < payload.length) {
    out.push([0x20 | (seq & 0x0F), ...payload.slice(off, off + 7)]);
    off += 7; seq++;
  }
  return out;
}
class IsoTpRx {
  constructor() { this.buf = []; this.expected = 0; this.lastSeq = 0; }
  feed(f) {                     // → {fc?, payload?}
    const t = f[0] >> 4;
    if (t === 0) { this.expected = f[0] & 0x0F; this.buf = f.slice(1, 1 + this.expected); return { payload: this.buf.slice() }; }
    if (t === 1) {
      this.expected = ((f[0] & 0x0F) << 8) | f[1]; this.buf = f.slice(2).slice(0, Math.min(6, this.expected)); this.lastSeq = 0;
      return { fc: [0x30, 0x00, 0x00] };   // FC: BS=0(连续发), STmin=0
    }
    if (t === 2) {
      const seq = f[0] & 0x0F;
      if (seq !== ((this.lastSeq + 1) & 0x0F)) throw new Error(`CF 序号错误: 期望 ${((this.lastSeq + 1) & 0x0F)}, 收到 ${seq}`);
      this.lastSeq = seq;
      this.buf.push(...f.slice(1));
      if (this.buf.length >= this.expected) return { payload: this.buf.slice(0, this.expected) };
    }
    return {};
  }
}

// ---------- UDS 服务端 (ISO 14229 子集) ----------
const NRC = { notSupported: 0x11, conditions: 0x22, securityDenied: 0x33, invalidKey: 0x35, attempts: 0x36, notInSession: 0x7E };
const SESSION = { DEFAULT: 0x01, PROGRAMMING: 0x02, EXTENDED: 0x03 };

// 器件侧"保密"算法: 固件里能找到的那种异或+旋转混淆 (仿真占位)
function rotl32(v, n) { return (((v << n) | (v >>> (32 - n))) >>> 0); }
function seedToKey(seed) { return (rotl32(seed ^ 0xC0FFEE01, 7) + 0x13371337) >>> 0; }

class Ecu {
  constructor(name, canId, opts = {}) {
    this.name = name; this.canId = canId;
    this.session = SESSION.DEFAULT;
    this.unlocked = false;
    this.attempts = 0;
    this.pSeed = opts.seed0 ?? 0x12345678;         // 固定初始状态 (Demo 5C 的靶子)
    this.curSeed = null;
    this.dids = { 0xF15A: Array.from(Buffer.from('CAL_SECRET=0xDEADBEEF\x00', 'latin1')) };
    this.tp = new IsoTpRx();
  }
  _neg(sid, nrc) { return [0x7F, sid, nrc]; }
  udsHandle(req) {
    const sid = req[0];
    switch (sid) {
      case 0x10: {                                   // DiagnosticSessionControl
        this.session = req[1]; if (req[1] === SESSION.DEFAULT) this.unlocked = false;
        return [0x50, req[1], 0x00, 0x19, 0x01, 0xF4];
      }
      case 0x27: {                                   // SecurityAccess
        const sub = req[1];
        if (this.session !== SESSION.EXTENDED && this.session !== SESSION.PROGRAMMING)
          return this._neg(0x27, NRC.notInSession);
        if (sub === 0x01) {                          // 请求种子
          if (this.unlocked) return [0x67, 0x01, 0, 0, 0, 0];  // 已解锁 → 全零种子
          this.pSeed = (Math.imul(1664525, this.pSeed) + 1013904223) >>> 0;  // 弱 LCG (Numerical Recipes 参数)
          this.curSeed = this.pSeed;
          return [0x67, 0x01, this.curSeed >>> 24, (this.curSeed >>> 16) & 0xFF, (this.curSeed >>> 8) & 0xFF, this.curSeed & 0xFF];
        }
        if (sub === 0x02) {                          // 提交密钥
          const key = ((req[2] << 24) | (req[3] << 16) | (req[4] << 8) | req[5]) >>> 0;
          if (this.curSeed != null && key === seedToKey(this.curSeed)) { this.unlocked = true; this.attempts = 0; return [0x67, 0x02]; }
          this.attempts++;
          return this._neg(0x27, this.attempts >= 3 ? NRC.attempts : NRC.invalidKey);
        }
        return this._neg(0x27, NRC.notSupported);
      }
      case 0x22: {                                   // ReadDataByIdentifier
        const did = (req[1] << 8) | req[2];
        if (!(did in this.dids)) return this._neg(0x22, NRC.notSupported);
        if (this.session === SESSION.DEFAULT) return this._neg(0x22, NRC.notInSession);
        if (!this.unlocked) return this._neg(0x22, NRC.securityDenied);
        return [0x62, req[1], req[2], ...this.dids[did]];
      }
      case 0x3E: return [0x7E, 0x00];               // TesterPresent
      default: return this._neg(sid, NRC.notSupported);
    }
  }
  rxCan(frame) {                                     // ISO-TP 入口 → 响应帧列表
    const r = this.tp.feed(frame);
    if (r.payload) {
      const resp = this.udsHandle(r.payload);
      return buildIsoTpFrames(resp);
    }
    return r.fc ? [r.fc] : [];
  }
  reset() {                                          // 掉电重启: PRNG 回到固定种子
    this.session = SESSION.DEFAULT; this.unlocked = false; this.pSeed = 0x12345678; this.curSeed = null; this.attempts = 0;
  }
}

// 主机侧: 发一个 UDS 请求, 取回响应负载 (忽略 FC 细节, 见简化声明)
function udsExchange(ecu, reqPayload) {
  const hostRx = new IsoTpRx();
  let resp = null;
  for (const f of buildIsoTpFrames(reqPayload)) {
    for (const out of ecu.rxCan(f)) {
      if (out[0] >> 4 === 3) continue;               // FC, 记录后继续
      const r = hostRx.feed(out);
      if (r.payload) resp = r.payload;
    }
  }
  return resp;
}

// ==================== 仿真开始 ====================
console.log('\nCAN / ISO-TP / UDS 攻击仿真 (ISO 11898 / 15765-2 / 14229)');

h1('KAT — 协议常量锚点');
{
  // ISO-TP 单帧: [0x0|len, ...payload≤7]
  ok(buildIsoTpFrames([0x10, 0x03]).length === 1 && buildIsoTpFrames([0x10, 0x03])[0][0] === 0x02,
    'SF: 2 字节负载 → [0x02, 0x10, 0x03] (高位 nibble=0)');
  // 首帧: 40 字节负载 → [0x10|len>>8, len&0xFF, ...6B] + 5 个 CF
  const fs = buildIsoTpFrames(new Array(40).fill(0xAA));
  ok(fs.length === 6 && fs[0][0] === 0x10 && fs[0][1] === 40,
    'FF: 40B 负载 → [0x10, 0x28, ...6B] + 5×CF (12-bit 长度域)');
  ok(fs.slice(1).every((f, i) => f[0] === (0x20 | ((i + 1) & 0x0F))),
    'CF: 序号从 1 起, 0x21,0x22,...,0x25 (4-bit 滚动计数)');
  // UDS: 肯定响应 SID = 请求 + 0x40
  ok([0x10, 0x27, 0x22, 0x3E].every(s => s + 0x40 === [0x50, 0x67, 0x62, 0x7E][[0x10, 0x27, 0x22, 0x3E].indexOf(s)]),
    'UDS 响应 SID = 请求+0x40 (0x10→0x50, 0x27→0x67, 0x22→0x62)');
  // NRC 常量
  ok(NRC.securityDenied === 0x33 && NRC.invalidKey === 0x35 && NRC.notInSession === 0x7E,
    'NRC: 0x33 security access denied / 0x35 invalid key / 0x7E not supported in session');
  // ISO 11898: 发送错误计数 +8/错误, >255 → bus-off
  ok(32 * 8 === 256 && 256 > 255, 'bus-off 判据: TEC 超过 255 → 32 次错误 × +8 = 256 (恰好越界)');
}

// ---------- Demo 1: 仲裁 ----------
h1('Demo 1 — CAN 仲裁: 低 ID 赢 (无认证广播总线的根源性质)');
{
  const contenders = [
    { node: '动力 ECU', id: 0x100 },
    { node: '仪表 ECU', id: 0x1A0 },
    { node: '诊断仪', id: 0x7DF },
  ];
  const winner = contenders.reduce((a, b) => (b.id < a.id ? b : a));
  console.log(`    同拍竞争: ${contenders.map(c => `${c.node}(0x${c.id.toString(16).toUpperCase()})`).join(', ')}`);
  console.log(`    仲裁胜者: ${winner.node} (0x${winner.id.toString(16).toUpperCase()}) —— ID 数值最小者`);
  ok(winner.id === 0x100, '数值最小 ID 获得总线 (0x100 < 0x1A0 < 0x7DF)');
  console.log(`    → 攻击含义: 持续发 0x000 等极低优先级帧 = 让所有正常报文永远排队 (泛洪 DoS)`);
}

// ---------- Demo 2: bus-off ----------
h1('Demo 2 — bus-off 攻击 (Cho & Shin, CCS 2016): 选择性踢 ECU 下线');
{
  const victim = { name: '仪表 ECU', id: 0x1A0, tec: 0, online: true };
  const bystander = { name: '动力 ECU', id: 0x100, tec: 0, online: true };
  const attacker = { name: '攻击者', tec: 0, resets: 0 };
  const rounds = [];
  for (let i = 1; i <= 33; i++) {
    if (!victim.online) { rounds.push(`${i}: 仪表 ECU 已 bus-off, 不再发送`); continue; }
    // 攻击者在受害者发送期间注入显性位 → CRC/位错误 → 全网报错误帧
    victim.tec += 8;                 // ISO 11898: 发送节点每次错误 TEC+8
    attacker.tec += 8;               // 攻击者自己也计数 (它不在乎)
    if (victim.tec > 127 && victim.tec <= 255) victim.state = 'error-passive (仍在线, 带延迟)';
    if (victim.tec > 255) { victim.online = false; victim.state = 'BUS-OFF'; }
    if (attacker.tec > 255) { attacker.tec = 0; attacker.resets++; }   // 攻击者掉线即自复位, 继续捣乱
    rounds.push(`${i}: TEC=${victim.tec}${victim.online ? '' : ' → 超过 255, bus-off!'}`);
  }
  console.log(`    攻击模型: 每轮让受害者的发送产生一次错误 (TEC+8)`);
  console.log(`    ${rounds.slice(0, 3).join('; ')} ...`);
  console.log(`    第 31 轮: TEC=248 (error-passive, 还在线); 第 32 轮: ${rounds[31]}`);
  ok(victim.tec === 256 && !victim.online, '仪表 ECU 经 32 次错误被驱逐下线 (TEC=256 > 255)');
  ok(bystander.tec === 0 && bystander.online, '旁观的另一 ECU 不受影响 (选择性 DoS)——攻击只针对 0x1A0');
  ok(attacker.resets >= 1, `攻击者自己也 bus-off ${attacker.resets} 次但立即复位 ("无所谓"的对手模型, 见 04 域 #6/#9)`);
  console.log(`    → 防御对照: SecOC 的 MAC 挡不住这里 (bus-off 是链路层机制); 检测靠 ECU 指纹/错误计数监控 (04 域 #7)`);
}

// ---------- Demo 3: ISO-TP 往返 ----------
h1('Demo 3 — ISO-TP 分帧往返 (UDS 的传输层)');
const body = new Ecu('车身 ECU', 0x7EA);
{
  const req = [0x10, 0x03];                          // 短请求 → SF
  const frames = buildIsoTpFrames(req);
  console.log(`    请求 ${hex(req)} → 1 个 SF: ${hex(frames[0])}`);
  const longResp = [0x62, 0xF1, 0x5A, ...new Array(20).fill(0x5A)];   // 23 字节 → FF+CF
  const rf = buildIsoTpFrames(longResp);
  console.log(`    23B 响应 → ${rf.length} 帧: FF=${hex(rf[0].slice(0, 4))}... CF=${hex([rf[1][0]])},${hex([rf[2][0]])},...`);
  const rx = new IsoTpRx();
  let got = null, fcSeen = false;
  for (const f of rf) { const r = rx.feed(f); if (r.fc) fcSeen = true; if (r.payload) got = r.payload; }
  ok(fcSeen, '接收方在 FF 后回 FlowControl [0x30, BS, STmin]');
  ok(got && got.length === 23 && got[0] === 0x62 && got.every((b, i) => i < 3 || b === 0x5A),
    '分帧重组后与原负载逐字节一致');
}

// ---------- Demo 4: UDS 正常(合法)流程 ----------
h1('Demo 4 — UDS 合法流程: 会话 → SecurityAccess → 读 DID');
{
  let r = udsExchange(body, [0x22, 0xF1, 0x5A]);
  console.log(`    默认会话直接读 DID F15A → ${hex(r)} (NRC 0x7E)`);
  ok(r[0] === 0x7F && r[2] === NRC.notInSession, '默认会话不支持 → NRC 0x7E (会话是第一道门)');

  r = udsExchange(body, [0x10, 0x03]);
  console.log(`    进扩展会话 → ${hex(r)}`);
  ok(r[0] === 0x50 && r[1] === 0x03, '0x10 03 → 0x50 03 (肯定响应+P2/P2*时序参数)');

  r = udsExchange(body, [0x27, 0x01]);
  const seed = ((r[2] << 24) | (r[3] << 16) | (r[4] << 8) | r[5]) >>> 0;
  console.log(`    请求种子 → ${hex(r)} (seed=0x${seed.toString(16).toUpperCase()})`);
  ok(r[0] === 0x67 && r[1] === 0x01, '0x27 01 → 0x67 01 + 4 字节种子');

  r = udsExchange(body, [0x27, 0x02, 0xDE, 0xAD, 0xBE, 0xEF]);
  console.log(`    错误 key 0xDEADBEEF → ${hex(r)} (NRC 0x35)`);
  ok(r[0] === 0x7F && r[2] === NRC.invalidKey, '错误密钥 → NRC 0x35 invalid key');

  const key = seedToKey(seed);                       // "合法用户知道算法"
  r = udsExchange(body, [0x27, 0x02, (key >>> 24) & 0xFF, (key >>> 16) & 0xFF, (key >>> 8) & 0xFF, key & 0xFF]);
  console.log(`    正确 key 0x${key.toString(16).toUpperCase()} → ${hex(r)} (解锁)`);
  ok(r[0] === 0x67 && r[1] === 0x02 && body.unlocked, '0x27 02 → 0x67 02, 安全访问通过');

  r = udsExchange(body, [0x22, 0xF1, 0x5A]);
  const txt = Buffer.from(r.slice(3, r.indexOf(0x00, 3))).toString('latin1');
  console.log(`    读 DID F15A → ${hex(r.slice(0, 8))}... ("${txt}")`);
  ok(r[0] === 0x62 && txt.startsWith('CAL_SECRET'), '解锁后敏感标定数据可读 (正常流程的终点)');
}

// ---------- Demo 5: 攻击场景 ----------
h1('Demo 5 — 攻击场景 A/B/C/D');

h2('A. 未认证直接读 (协议防线成立)');
{
  const ecu = new Ecu('车身 ECU', 0x7EA);
  udsExchange(ecu, [0x10, 0x03]);
  const r = udsExchange(ecu, [0x22, 0xF1, 0x5A]);
  console.log(`    跳过 0x27 直接读 → ${hex(r)} (NRC 0x33)`);
  ok(r[0] === 0x7F && r[2] === NRC.securityDenied, '未解锁 → NRC 0x33: 协议层把门外汉挡住了');
}

h2('B. 固件逆向提取 seed-key 算法 → 认证形同虚设');
{
  const ecu = new Ecu('车身 ECU', 0x7EA);
  udsExchange(ecu, [0x10, 0x03]);
  const r = udsExchange(ecu, [0x27, 0x01]);
  const seed = ((r[2] << 24) | (r[3] << 16) | (r[4] << 8) | r[5]) >>> 0;
  // 攻击者从 dump 出的固件 (knowledge/02 的提取流程) 里恢复了算法:
  const recoveredAlgo = seedToKey;                   // "逆向完成" 的占位
  const key = recoveredAlgo(seed);
  const r2 = udsExchange(ecu, [0x27, 0x02, (key >>> 24) & 0xFF, (key >>> 16) & 0xFF, (key >>> 8) & 0xFF, key & 0xFF]);
  const r3 = udsExchange(ecu, [0x22, 0xF1, 0x5A]);
  console.log(`    用恢复的算法对种子 0x${seed.toString(16).toUpperCase()} 算 key → ${hex(r2)} → 读 → ${hex(r3.slice(0, 8))}...`);
  ok(r2[0] === 0x67 && r3[0] === 0x62, '算法一旦泄露, 0x27 完全失效 (安全性=算法保密性, 不是密码学)');
  console.log(`    → 这就是 CANdid'24 / 历代 UDS 研究盯住 seed-key 的原因 (05 域 #4)`);
}

h2('C. ECU 复位后种子重复 → 重放旧 key');
{
  const ecu = new Ecu('车身 ECU', 0x7EA);
  udsExchange(ecu, [0x10, 0x03]);
  const s1 = udsExchange(ecu, [0x27, 0x01]).slice(2);
  const k1 = seedToKey(parseInt(s1.map(b => b.toString(16).padStart(2, '0')).join(''), 16) >>> 0);
  console.log(`    会话1: 种子=${hex(s1)}, 合法 key 已记录 (如被嗅探/曾短暂解锁)`);

  ecu.reset();                                       // 掉电重启 (拔保险丝/总线复位)
  udsExchange(ecu, [0x10, 0x03]);
  const s2 = udsExchange(ecu, [0x27, 0x01]).slice(2);
  console.log(`    复位后: 种子=${hex(s2)} ${s1.join() === s2.join() ? '(与上次完全相同!)' : '(不同)'}`);
  ok(s1.join() === s2.join(), '弱 PRNG 固定初始状态 → 复位后种子重复');

  const r = udsExchange(ecu, [0x27, 0x02, (k1 >>> 24) & 0xFF, (k1 >>> 16) & 0xFF, (k1 >>> 8) & 0xFF, k1 & 0xFF]);
  ok(r[0] === 0x67, '重放会话1 的 key 直接解锁 (无需知道算法, 只需记录)');
  const r3 = udsExchange(ecu, [0x22, 0xF1, 0x5A]);
  ok(r3[0] === 0x62, '→ 敏感 DID 再次可读: "拔插一下保险丝"就复现的攻击');
}

h2('D. 功能寻址广播 → 枚举全网关 ECU');
{
  const ecus = [new Ecu('网关', 0x7E8), new Ecu('车身', 0x7EA), new Ecu('车机', 0x7EC)];
  console.log(`    向功能寻址地址 0x7DF 广播 [10 03] (进扩展会话):`);
  const responders = ecus.filter(e => e.rxCan(buildIsoTpFrames([0x10, 0x03])[0]).length > 0);
  responders.forEach(e => {
    const r = udsExchange(e, [0x10, 0x03]);
    console.log(`      0x${e.canId.toString(16).toUpperCase()} ${e.name} → ${hex(r)} (0x50)`);
  });
  ok(responders.length === 3, '一条广播报文让 3 个 ECU 应答 → 诊断拓扑零成本枚举');
  console.log(`    → 攻击链: 0x7DF 枚举 → 逐个试 0x27/0x22 → 找到没锁门的 ECU (B/C 场景的入口)`);
}

// ---------- 总结 ----------
h1('总结');
console.log(`    通过 ${pass} 项, 失败 ${fail} 项`);
console.log(`
    攻击含义(对照 knowledge/04 / 05):
    * CAN 的三大根源性质: 无认证广播 + 低ID仲裁 + 错误计数器 → 注入/饥饿/bus-off
    * UDS 的安全性依赖 "算法保密 + 种子管理", 两者都会在工程里出错
    * 复位重放(B/C 类)不需要任何密码学突破 —— 只要种子重复
    * 防御对照: SecOC(报文认证)/0x29(服务认证)/IDS(ECU 指纹), 见 04 域 #14 / 05 域方法地图`);
process.exit(fail === 0 ? 0 : 1);
