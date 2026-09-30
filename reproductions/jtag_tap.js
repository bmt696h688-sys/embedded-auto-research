#!/usr/bin/env node
/**
 * 实验 1: IEEE 1149.1 JTAG TAP 状态机与扫描链枚举仿真
 * =====================================================
 * 对应知识库: knowledge/01-debug-interfaces (调试接口攻击面)
 * 参考: IEEE Std 1149.1 (TAP 16 态状态机 / IDCODE / BYPASS)
 *
 * 零依赖 Node.js 仿真,验证三个"攻击者第一步就要做"的操作:
 *   Demo 1 — TAP 复位后扫描 DR,枚举链上器件的 IDCODE(识别芯片型号)
 *   Demo 2 — 装载全 1 的 IR (BYPASS),用 1-bit 旁路寄存器测链长(数器件)
 *   Demo 3 — 状态机自检: 整张转移表 + 标准复位序列 (5 个 TMS=1)
 *
 * 现实攻击含义:
 *   - IDCODE 枚举 → 确认 SoC/链上器件型号 → 查手册定位调试口与安全位
 *     (Portcullis 在 BroadLink RM Pro 上的第一步, 见 01 域 #17)
 *   - BYPASS 链长 → 在不知道任何器件型号时就能数出链上有几个器件
 *   - 状态机是所有 JTAG 工具 (OpenOCD/JTAGulator/JTAGenum) 的内核:
 *     理解它 = 理解 "为什么留着的调试口等价于内存读取接口"
 *
 * 运行: node jtag_tap.js   (确定性,无随机,输出逐位可复现)
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

// ---------- TAP 16 态 (IEEE 1149.1) ----------
const S = Object.freeze({
  TLR: 'Test-Logic-Reset', RTI: 'Run-Test/Idle',
  SELDR: 'Select-DR-Scan', CAPDR: 'Capture-DR', SHDR: 'Shift-DR',
  EX1DR: 'Exit1-DR', PADR: 'Pause-DR', EX2DR: 'Exit2-DR', UPDDR: 'Update-DR',
  SELIR: 'Select-IR-Scan', CAPIR: 'Capture-IR', SHIR: 'Shift-IR',
  EX1IR: 'Exit1-IR', PAIR: 'Pause-IR', EX2IR: 'Exit2-IR', UPDIR: 'Update-IR',
});

// 转移表: NEXT[state][tms] 。逐条对照标准状态图录入,是本实验的 KAT 锚点之一。
const NEXT = {
  [S.TLR]:   [S.RTI,   S.TLR],   // 无论何处,连续 5 个 TMS=1 必达 TLR
  [S.RTI]:   [S.RTI,   S.SELDR],
  [S.SELDR]: [S.CAPDR, S.SELIR],
  [S.CAPDR]: [S.SHDR,  S.EX1DR],
  [S.SHDR]:  [S.SHDR,  S.EX1DR], // 移位态: TMS=0 继续移, =1 退出去
  [S.EX1DR]: [S.PADR,  S.UPDDR],
  [S.PADR]:  [S.PADR,  S.EX2DR],
  [S.EX2DR]: [S.SHDR,  S.UPDDR],
  [S.UPDDR]: [S.RTI,   S.SELDR],
  [S.SELIR]: [S.CAPIR, S.TLR],   // 注意: Select-IR 时 TMS=1 直接回 TLR
  [S.CAPIR]: [S.SHIR,  S.EX1IR],
  [S.SHIR]:  [S.SHIR,  S.EX1IR],
  [S.EX1IR]: [S.PAIR,  S.UPDIR],
  [S.PAIR]:  [S.PAIR,  S.EX2IR],
  [S.EX2IR]: [S.SHIR,  S.UPDIR],
  [S.UPDIR]: [S.RTI,   S.SELDR],
};

// ---------- 器件模型 ----------
// IDCODE 32-bit 布局(标准规定): [31:28]version [27:12]part [11:1]manufacturer [0]='1'
function makeIdcode(version, part, mfr) {
  return (((version & 0xf) << 28) | ((part & 0xffff) << 12) | ((mfr & 0x7ff) << 1) | 0x1) >>> 0;
}
function decodeIdcode(id) {
  return {
    raw: '0x' + id.toString(16).toUpperCase().padStart(8, '0'),
    version: (id >>> 28) & 0xf,
    part: (id >>> 12) & 0xffff,
    manufacturer: (id >>> 1) & 0x7ff,
    lsbFixedOne: id & 0x1, // 标准强制 bit0 = 1 (据此可判断器件是否支持 IDCODE)
  };
}

// 仿真板卡: 两颗器件挂在 JTAG 链上(示例: 主控 MCU + 一颗 CPLD)
//   devices[0] = TDI 侧第一颗; devices[1] = TDO 侧最后一颗
function makeDevice(name, irLen, idcode) {
  return {
    name, irLen,
    idcode,                    // 若 null 则无 IDCODE 寄存器(TLR 后 IR 装入 BYPASS)
    ir: null,                  // 当前生效指令 (TLR 后自动装入 IDCODE 或 BYPASS)
    irShift: [],               // IR 移位链
    drShift: [],               // DR 移位链
    bypass: 0,                 // BYPASS 1-bit 寄存器
  };
}

const INSTR = { IDCODE: 'IDCODE', BYPASS: 'BYPASS' };

// ---------- TAP 控制器 ----------
class Tap {
  constructor(devices) {
    this.dev = devices;
    this.state = S.TLR;
    this.trace = [];          // 状态轨迹(调试/演示用)
    this._drChain = [];       // DR 移位链(进入 Shift-DR 前由 Capture-DR 装载)
    this._irChain = [];       // IR 移位链
    this._enterTLR();
  }
  _enterTLR() {
    // 标准行为: 进入 Test-Logic-Reset 时, IR 装入 IDCODE(若无则 BYPASS)
    for (const d of this.dev) d.ir = d.idcode != null ? INSTR.IDCODE : INSTR.BYPASS;
  }
  // 一个 TCK 上升沿。返回 TDO(仅移位态有意义,否则 null)。
  clock(tms, tdi = 0) {
    let tdo = null;
    const st = this.state;

    if (st === S.SHDR) {
      tdo = this._drChain.length ? this._drChain[0] : 0;
      this._drChain.shift();
      this._drChain.push(tdi & 1);
    } else if (st === S.SHIR) {
      tdo = this._irChain.length ? this._irChain[0] : 0;
      this._irChain.shift();
      this._irChain.push(tdi & 1);
    }
    const next = NEXT[st][tms & 1];

    // 边沿动作: 离开 Capture 态时装载并行数据;进入 Update 态时锁存
    if (st === S.CAPDR) {
      // 每颗器件按当前指令把对应寄存器挂上 DR 移位链
      this._drChain = [];
      for (let i = this.dev.length - 1; i >= 0; i--) {   // TDO 侧在前
        const d = this.dev[i];
        const bits = (d.ir === INSTR.IDCODE && d.idcode != null)
          ? toBits32(d.idcode)      // LSB 在前
          : [d.bypass];             // BYPASS: 1 bit
        this._drChain.push(...bits);
      }
    } else if (st === S.CAPIR) {
      // 标准: Capture-IR 装入固定模式,最低 2 位须为 01
      this._irChain = [];
      for (let i = this.dev.length - 1; i >= 0; i--) {
        const d = this.dev[i];
        const pattern = [1, 0, ...Array(d.irLen - 2).fill(0)]; // bit0=1, bit1=0
        this._irChain.push(...pattern);
      }
    } else if (next === S.UPDIR && (st === S.EX1IR || st === S.EX2IR)) {
      // Update-IR: 把移位链内容按器件切回,LSB-first,装入生效 IR
      let idx = 0;
      for (let i = this.dev.length - 1; i >= 0; i--) {
        const d = this.dev[i];
        d.irShift = this._irChain.slice(idx, idx + d.irLen); idx += d.irLen;
        d.ir = fromBits(d.irShift);   // 整数语义仅用于比较(见 isBypassAll)
      }
    } else if (next === S.UPDDR) {
      let idx = 0;
      for (let i = this.dev.length - 1; i >= 0; i--) {
        const d = this.dev[i];
        const len = (d.ir === INSTR.IDCODE && d.idcode != null) ? 32 : 1;
        d.drShift = this._drChain.slice(idx, idx + len); idx += len;
        if (len === 1) d.bypass = d.drShift[0]; // BYPASS 寄存器保留移入的位
      }
    }

    this.state = next;
    this.trace.push(`${st} --TMS=${tms & 1}--> ${next}${tdo != null ? ` (TDO=${tdo})` : ''}`);
    return tdo;
  }
  // IR 判断"全 1"用移位链(按位),避免整数位宽歧义
  allIrBitsAre(bit) { return this._irChain ? this._irChain.every(b => b === bit) : false; }
  // IR 装载后校验各器件移位链是否全 1 (BYPASS = all ones,标准规定)
  instrIsBypassPerDevice() {
    return this.dev.every(d => d.irShift.length === d.irLen && d.irShift.every(b => b === 1));
  }
}
function toBits32(v) { const b = []; for (let i = 0; i < 32; i++) b.push((v >>> i) & 1); return b; }
function fromBits(bits) { let v = 0; bits.forEach((b, i) => v |= (b & 1) << i); return v >>> 0; }

// ---------- 高层扫描操作(攻击工具的做法) ----------
function resetTap(tap) { for (let i = 0; i < 5; i++) tap.clock(1); }        // 5×TMS=1 → TLR
function gotoShiftDR(tap) { [0, 1, 0, 0].forEach(t => tap.clock(t)); }      // RTI→SelDR→CapDR→ShDR
function gotoShiftIRFromRTI(tap) { [1, 1, 0, 0].forEach(t => tap.clock(t)); } // RTI→SelDR→SelIR→CapIR→ShIR
function shiftOut(tap, nBits, tdiAfterFirst = 0) {                          // 移出 nBits 位(TDO 侧先出)
  const out = [];
  for (let i = 0; i < nBits; i++) out.push(tap.clock(i < nBits - 1 ? 0 : 1, i === 0 ? 1 : tdiAfterFirst));
  return out; // 最后一拍带 TMS=1 → Exit1
}
function backToRTI(tap) { [1, 0].forEach(t => tap.clock(t)); }              // Exit1→Update→RTI

// ==================== 仿真开始 ====================
console.log('JTAG TAP 状态机与扫描链枚举仿真 (IEEE 1149.1)');
console.log(`Node ${process.version} | 零依赖 | 确定性输出`);

const board = [
  makeDevice('MCU-主控 (示例: Cortex-M)', 4, makeIdcode(0x4, 0x0BA0, 0x47B)), // 0x47B=ARM 的 JEP106 前缀风格示例
  makeDevice('CPLD-协处理', 8, makeIdcode(0x0, 0xABCD, 0x049)),
];
const tap = new Tap(board);

// ---------- Demo 3(先自检内核): 状态机转移表 KAT ----------
h1('Demo 3 — TAP 状态机自检 (转移表 = 本实验 KAT 锚点)');
h2('任意状态连续 5 个 TMS=1 必达 Test-Logic-Reset');
{
  const states = Object.values(S);
  let allReach = true;
  for (const s0 of states) {
    const t = new Tap(board.map(d => makeDevice(d.name, d.irLen, d.idcode)));
    t.state = s0;
    for (let i = 0; i < 5; i++) t.clock(1);
    if (t.state !== S.TLR) { allReach = false; console.log(`      ${s0} → 5×TMS=1 → ${t.state} (!)`); }
  }
  ok(allReach, '全部 16 个状态经 5×TMS=1 均回到 TLR (标准保证)');

  const t = new Tap([makeDevice('x', 4, makeIdcode(1, 2, 3))]);
  t.clock(0); ok(t.state === S.RTI, 'TLR + TMS=0 → Run-Test/Idle');
  t.clock(1); ok(t.state === S.SELDR, 'RTI + TMS=1 → Select-DR-Scan');
  t.clock(1); ok(t.state === S.SELIR, 'SelDR + TMS=1 → Select-IR-Scan');
  t.clock(1); ok(t.state === S.TLR, 'SelIR + TMS=1 → TLR (不走 CapIR!)');
  t.clock(1); t.clock(0); t.clock(1); t.clock(0); t.clock(0);
  ok(t.state === S.SHDR, 'RTI→SelDR→CapDR→ShDR 路径按预期');
}
h2('TLR 后 IR 自动装入 IDCODE (标准行为,攻击者据此枚举型号)');
ok(board.every(d => d.ir === INSTR.IDCODE), '两颗器件 TLR 后 IR=IDCODE');

// ---------- Demo 1: IDCODE 枚举 ----------
h1('Demo 1 — DR 扫描枚举 IDCODE (识别链上器件)');
resetTap(tap);
gotoShiftDR(tap);
const raw = shiftOut(tap, 64);          // 2 器件 × 32 bit (TDO 侧器件先出)
backToRTI(tap);

const ids = [fromBits(raw.slice(0, 32)), fromBits(raw.slice(32, 64))];
console.log(`    链上器件(TDO 侧在前):`);
ids.forEach((id, i) => {
  const d = decodeIdcode(id);
  const owner = board[board.length - 1 - i].name;
  console.log(`      [${i}] ${owner}`);
  console.log(`          IDCODE=${d.raw}  version=0x${d.version.toString(16)} part=0x${d.part.toString(16).toUpperCase().padStart(4, '0')} mfr=0x${d.manufacturer.toString(16)} bit0=${d.lsbFixedOne}`);
});
ok(ids.every(id => (id & 1) === 1), '两个 IDCODE 的 bit0 均为 1 (标准强制,也是"该器件支持 IDCODE"的判据)');
ok(ids[0] === board[1].idcode && ids[1] === board[0].idcode, '读回值与仿真链定义一致(先出 TDO 侧器件)');
ok(decodeIdcode(ids[1]).part === 0x0BA0, '主控 part number 0x0BA0 = ARM CoreSight DP 的典型值(示例器件)');

// ---------- Demo 2: BYPASS 链长测量 ----------
h1('Demo 2 — 全 1 指令(BYPASS)测链长 (不知道型号也能数器件)');
resetTap(tap);                          // TLR → RTI
tap.clock(0);                           // 进 RTI
gotoShiftIRFromRTI(tap);                // → Shift-IR
// 向 IR 移入全 1 (每器件 irLen 位): 4 + 8 = 12 bit 的 1
const irEcho = shiftOut(tap, 12, 1);    // 移出 Capture-IR 固定模式,移入全 1
backToRTI(tap);                         // Update-IR 生效
ok(tap.instrIsBypassPerDevice(), 'Update-IR 后两颗器件 IR 均为全 1 (= BYPASS, 标准规定)');
console.log(`    Capture-IR 固定模式回读(低 2 位须 01): 主控=[${irEcho.slice(8).reverse().join('')}] CPLD=[${irEcho.slice(0, 8).reverse().join('')}]`);
ok(irEcho[8] === 1 && irEcho[9] === 0, '主控 Capture-IR 低 2 位 = 01 (标准要求,可用于测 IR 长度)');

// 现在 DR 链 = 2 个 1-bit BYPASS。打入一个标记位 1,数几拍后它从 TDO 冒出来。
// 时序: 标记在第 1 拍注入 TDI,经 N 个寄存器位传到 TDO,在第 N+1 拍被采样。
gotoShiftDR(tap);
let markerAt = -1;
for (let i = 0; i < 8; i++) {
  const tdo = tap.clock(i < 7 ? 0 : 1, i === 0 ? 1 : 0);  // 第 1 拍 TDI=1(标记),其余 0
  if (tdo === 1 && markerAt < 0) markerAt = i + 1;
}
backToRTI(tap);
const chainLen = markerAt - 1;
console.log(`    标记位在第 ${markerAt} 个 TCK 从 TDO 出现 → 链长 = ${chainLen} 颗器件(每颗 BYPASS 贡献 1 bit)`);
ok(chainLen === 2, 'BYPASS 链长 = 2 (= 器件数)');

// ---------- 总结 ----------
h1('总结');
console.log(`    通过 ${pass} 项, 失败 ${fail} 项`);
console.log(`
    攻击含义(对照 knowledge/01):
    * IDCODE 枚举 = JTAGuler/JTAGenum 的核心功能: 不看手册先问链上是谁
    * BYPASS 测链长 = 零知识情况下确认链拓扑
    * 真正的杀伤在 Update-IR 之后: 指令可以是 EXTEST(直接驱动引脚),
      也可以是厂商调试指令(OpenOCD halt → dump RAM 里的口令与密钥)
    * 防御对照: RDP/APPROTECT/secure JTAG 锁的正是 "这条链还能不能这么用"`);
process.exit(fail === 0 ? 0 : 1);
