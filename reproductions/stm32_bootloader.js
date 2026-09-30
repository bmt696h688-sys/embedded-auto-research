#!/usr/bin/env node
/**
 * 实验 2: STM32 UART 自举协议 (AN3155) 与读保护 (RDP) 仿真
 * =========================================================
 * 对应知识库: knowledge/01-debug-interfaces (RDP 攻防) + knowledge/02-firmware-extraction (bootROM 提取)
 * 规范锚点: ST AN3155 "USART protocol used in the STM32 bootloader"
 *
 * 零依赖 Node.js 协议级仿真,复现"无调试器、只靠一根 USB-TTL 拿固件"的完整交互:
 *   Demo 1 — 0x7F 同步 + Get (0x00) + GetID (0x02): 枚举 bootloader 版本与命令集
 *   Demo 2 — Read Memory (0x11) 从 0x08000000 dump 固件, 找到其中的"密钥"
 *   Demo 3 — Readout Protect (0x82) 打开 RDP: Read Memory 被拒 (NACK 0x1F)
 *   Demo 4 — Readout Unprotect (0x92): RDP 降级 = 全片擦除 (密钥没了 → 降级不是绕过)
 *   Demo 5 — "毛刺"模型: 电压毛刺跳过 RDP 比较时, 受保护固件直接外泄
 *            (WOOT'20 / picopwner 攻击的机理级模型, 非电路仿真)
 *
 * 协议规则 (AN3155, 本实验的 KAT 锚点):
 *   - 同步字节 0x7F → ACK 0x79
 *   - 单字节负载的校验 = 按位取反 (0x00↔0xFF, 0x11↔0xEE, 0x31↔0xCE, 0x02↔0xFD ...)
 *   - 3 字节地址的校验 = 三字节 XOR
 *   - Read 的字节数包 [n-1, ~(n-1)]; Write 的数据包 [n-1, ...data, XOR(n-1, ...data)]
 *   - ACK=0x79, NACK=0x1F
 *
 * 运行: node stm32_bootloader.js   (确定性,无随机)
 */

'use strict';

// ---------- 断言工具 ----------
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log(`    [PASS] ${label}`); }
  else { fail++; console.log(`    [FAIL] ${label}  <-- 请检查仿真实现`); }
}
function h1(t) { console.log(`\n${'='.repeat(72)}\n${t}\n${'='.repeat(72)}`); }
const hex = (a) => a.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
const xorAll = (a) => a.reduce((x, b) => x ^ b, 0);

const ACK = 0x79, NACK = 0x1F;

// ---------- 目标器件仿真 (STM32 + AN3155 bootloader) ----------
// 地址建模说明: AN3155 的地址字段是 3 字节(24 位空间)。真实 STM32 的 flash 位于
// 32 位地址 0x08000000,自举模式下经 0x00000000 起的别名窗口访问(地址 0x000000
// 即 flash 首字节;stm32flash 等主机工具按此映射)。本仿真直接以 0x000000 为
// flash 基址 —— 协议规则与 RDP 行为不受此建模选择影响。
const FLASH_BASE = 0x000000;                 // flash 别名窗口基址(见上)
const FLASH_SIZE = 0x10000;                  // 64 KB 模型

class Stm32Target {
  constructor(opts = {}) {
    this.rdp = opts.rdp || 0;
    // 毛刺模型: WOOT'20 类攻击让 "if (rdp) 拒绝" 这一步被跳过
    this.glitchSkipsRdpCheck = !!opts.glitchSkipsRdpCheck;
    this.bootloaderVersion = 0x31;              // v3.1 风格
    this.pid = [0x04, 0x66];                    // 假设为 2 字节产品 ID
    this.commands = [0x00, 0x02, 0x11, 0x21, 0x31, 0x43, 0x82, 0x92];
    this.flash = new Array(FLASH_SIZE).fill(0xFF);
    // 预置一段"固件": 向量表风格开头 + 危险字符串
    const fw = [
      0x40, 0x00, 0x00, 0x20,                   // 初始 SP
      0x09, 0x10, 0x00, 0x08,                   // Reset_Handler
    ];
    fw.push(...Array.from(Buffer.from('SECRET=Tr0ub4dor&3 (device key)\x00', 'latin1')));
    fw.forEach((b, i) => this.flash[i] = b);
    this.pending = null;                        // 多包命令的中间状态
    this.log = [];
  }
  // RDP 检查 —— Demo 5 的"毛刺"就打在这一行
  _readBlocked() { return this.rdp > 0 && !this.glitchSkipsRdpCheck; }
  _massErase() { this.flash.fill(0xFF); }
  rx(bytes) {
    const b = bytes;
    // 1) 自动波特率同步
    if (b.length === 1 && b[0] === 0x7F) { this.log.push('sync 0x7F'); return [ACK]; }
    // 2) 命令包 [cmd, ~cmd]
    if (this.pending === null && b.length === 2) {
      const [cmd, chk] = b;
      if (chk !== ((~cmd) & 0xFF)) { this.log.push(`bad checksum cmd=${hex([cmd])}`); return [NACK, NACK]; }
      switch (cmd) {
        case 0x00: // Get
          this.log.push('Get');
          return [ACK, this.commands.length - 1, this.bootloaderVersion, ...this.commands, ACK];
        case 0x02: // Get ID
          this.log.push('GetID');
          return [ACK, this.pid.length - 1, ...this.pid, ACK];
        case 0x11: // Read Memory
          if (this._readBlocked()) { this.log.push('Read rejected (RDP)'); return [NACK]; }
          this.pending = { cmd, stage: 'addr' }; this.log.push('Read accepted');
          return [ACK];
        case 0x31: // Write Memory
          if (this.rdp > 0) { this.log.push('Write rejected (RDP)'); return [NACK]; }
          this.pending = { cmd, stage: 'addr' }; this.log.push('Write accepted');
          return [ACK];
        case 0x21: // Go
          this.pending = { cmd, stage: 'addr' };
          return [ACK];
        case 0x43: // Erase
          this.pending = { cmd, stage: 'spec' };
          return [ACK];
        case 0x82: // Readout Protect: ACK, 全片擦除+置位, 再 ACK
          this._massErase(); this.rdp = 1; this.log.push('RDP1 enabled (mass erase)');
          return [ACK, ACK];
        case 0x92: // Readout Unprotect: ACK, 全片擦除+清除, 再 ACK
          this._massErase(); this.rdp = 0; this.log.push('RDP cleared (mass erase)');
          return [ACK, ACK];
        default:
          return [NACK];
      }
    }
    // 3) 后续包: 地址 / 数据 / 擦除规格
    if (this.pending) {
      const p = this.pending;
      if (p.cmd === 0x11 && p.stage === 'addr') { // [a23..a16, a15..a8, a7..a0, XOR]
        if (b.length !== 4 || b[3] !== (b[0] ^ b[1] ^ b[2])) { this.pending = null; return [NACK, NACK]; }
        p.addr = (b[0] << 16) | (b[1] << 8) | b[2]; p.stage = 'count';
        return [ACK];
      }
      if (p.cmd === 0x11 && p.stage === 'count') { // [n-1, ~(n-1)]
        if (b.length !== 2 || b[1] !== ((~b[0]) & 0xFF)) { this.pending = null; return [NACK, NACK]; }
        const n = b[0] + 1;
        const off = p.addr - FLASH_BASE;
        const data = (off >= 0 && off + n <= FLASH_SIZE) ? this.flash.slice(off, off + n) : new Array(n).fill(0xEE);
        this.pending = null;
        this.log.push(`Read @0x${p.addr.toString(16).toUpperCase()} n=${n}`);
        return [ACK, ...data];
      }
      if (p.cmd === 0x31 && p.stage === 'addr') {
        if (b.length !== 4 || b[3] !== (b[0] ^ b[1] ^ b[2])) { this.pending = null; return [NACK, NACK]; }
        p.addr = (b[0] << 16) | (b[1] << 8) | b[2]; p.stage = 'data';
        return [ACK];
      }
      if (p.cmd === 0x31 && p.stage === 'data') { // [n-1, ...data, XOR 全部]
        const body = b.slice(0, -1), chk = b[b.length - 1];
        if (chk !== xorAll(body)) { this.pending = null; return [NACK, NACK]; }
        const n = body[0] + 1, data = body.slice(1);
        const off = p.addr - FLASH_BASE;
        if (off >= 0 && off + n <= FLASH_SIZE) data.forEach((v, i) => this.flash[off + i] = v);
        this.pending = null;
        this.log.push(`Write @0x${p.addr.toString(16).toUpperCase()} n=${n}`);
        return [ACK];
      }
      if (p.cmd === 0x43 && p.stage === 'spec') {
        if (b.length === 2 && b[0] === 0xFF && b[1] === 0x00) { this._massErase(); this.pending = null; this.log.push('Global erase'); return [ACK]; }
        this.pending = null; return [NACK];
      }
      if (p.cmd === 0x21 && p.stage === 'addr') {
        if (b.length !== 4 || b[3] !== (b[0] ^ b[1] ^ b[2])) { this.pending = null; return [NACK, NACK]; }
        this.pending = null; this.log.push('Go (跳转, 仿真不执行)'); return [ACK];
      }
    }
    return [NACK];
  }
}

// ---------- 主机侧 (按 AN3155 组包) ----------
function sync(t) { return t.rx([0x7F]); }
function cmd(t, c) { return t.rx([c, (~c) & 0xFF]); }
function addrPacket(addr) { const a = [(addr >>> 16) & 0xFF, (addr >>> 8) & 0xFF, addr & 0xFF]; return [...a, a[0] ^ a[1] ^ a[2]]; }
function readMem(t, addr, n) {
  const r1 = cmd(t, 0x11); if (r1[0] !== ACK) return r1;
  const r2 = t.rx(addrPacket(addr)); if (r2[0] !== ACK) return r2;
  return t.rx([(n - 1) & 0xFF, (~(n - 1)) & 0xFF]);
}
function writeMem(t, addr, data) {
  const r1 = cmd(t, 0x31); if (r1[0] !== ACK) return r1;
  const r2 = t.rx(addrPacket(addr)); if (r2[0] !== ACK) return r2;
  const body = [(data.length - 1) & 0xFF, ...data];
  return t.rx([...body, xorAll(body)]);
}

// ==================== 仿真开始 ====================
console.log('STM32 UART 自举协议 (AN3155) 与读保护仿真');
console.log(`Node ${process.version} | 零依赖 | 确定性输出`);

// ---------- KAT: 协议常量与校验规则 ----------
h1('KAT — AN3155 校验规则(实验的规范锚点)');
{
  const pairs = { 0x00: 0xFF, 0x02: 0xFD, 0x11: 0xEE, 0x21: 0xDE, 0x31: 0xCE, 0x43: 0xBC, 0x82: 0x7D, 0x92: 0x6D };
  ok(Object.entries(pairs).every(([c, k]) => ((~c) & 0xFF) === k),
     '8 个命令字与其校验字节构成按位取反对 (0x11↔0xEE 等)');
  ok(xorAll([0x00, 0xAB, 0xCD]) === 0x66, '地址 0x0000ABCD 的 XOR 校验 = 0x66 (3 字节异或规则)');
  const t = new Stm32Target();
  ok(sync(t)[0] === ACK, '同步字节 0x7F → ACK 0x79');
  const bad = t.rx([0x11, 0x11]); // 错误校验(未取反)
  ok(bad[0] === NACK && bad[1] === NACK, '命令校验错误 → 双 NACK 0x1F');
}

// ---------- Demo 1+2: 未保护器件的完整侦察与 dump ----------
h1('Demo 1-2 — 同步 / Get / GetID / Read Memory(未保护器件)');
const dev = new Stm32Target({ rdp: 0 });
{
  const g = cmd(dev, 0x00);
  console.log(`    Get       → ACK; bootloader v0x${g[2].toString(16)}; 支持命令: ${hex(g.slice(3, 3 + 8))}`);
  ok(g[0] === ACK && g[2] === 0x31, 'Get 返回版本 0x31 与命令表 (ACK...ACK 帧)');
  const id = cmd(dev, 0x02);
  console.log(`    GetID     → ACK; PID = 0x${id[2].toString(16).toUpperCase().padStart(2, '0')}${id[3].toString(16).toUpperCase().padStart(2, '0')}`);
  ok(id[0] === ACK && id.length === 5 && id[1] === dev.pid.length - 1, 'GetID 帧结构 = ACK,len,PID_hi,PID_lo,ACK');

  const dump = readMem(dev, FLASH_BASE, 64);
  const secretAt = dump.indexOf(0x53 /* 'S' */);
  const secret = Buffer.from(dump.slice(secretAt, dump.indexOf(0x00, secretAt))).toString('latin1');
  console.log(`    Read @0x000000(flash 别名窗口) × 64B:\n      ${hex(dump.slice(0, 16))} ...`);
  console.log(`      其中发现字符串: "${secret}"`);
  ok(dump[0] === ACK && dump[1] === 0x40 && dump[5] === 0x09, '读回固件头 (SP=0x20000040, Reset=0x08001009)');
  ok(secret.startsWith('SECRET='), '固件内明文密钥被完整提取 (未保护 = 全裸)');
}

// ---------- Demo 3: 打开 RDP, 读保护生效 ----------
h1('Demo 3 — Readout Protect (0x82): 读保护生效');
{
  const r = cmd(dev, 0x82);
  console.log(`    Readout Protect → ${hex(r)} (ACK + 擦除完成 ACK), 全片已被擦除, RDP=1`);
  ok(r[0] === ACK && r[1] === ACK && dev.rdp === 1, 'RDP 置位命令返回双 ACK');
  ok(dev.flash.every(b => b === 0xFF), '置位过程伴随全片擦除 (密钥此时就已不存在于 flash)');
  const g = cmd(dev, 0x00);
  ok(g[0] === ACK, '诊断命令 Get 仍可用 (bootloader 本身不锁)');
  const rr = readMem(dev, FLASH_BASE, 16);
  console.log(`    Read Memory @RDP1 → ${hex(rr)} (NACK)`);
  ok(rr[0] === NACK, 'RDP=1 时 Read Memory 被拒 (0x1F) —— 协议层防线成立');
  const wr = writeMem(dev, FLASH_BASE, [0xAA, 0xBB]);
  ok(wr[0] === NACK, 'RDP=1 时 Write Memory 同样被拒');
}

// ---------- Demo 4: RDP 降级 = 擦除, 不是绕过 ----------
h1('Demo 4 — Readout Unprotect (0x92): 降级的代价');
{
  const r = cmd(dev, 0x92);
  console.log(`    Readout Unprotect → ${hex(r)}, RDP=${dev.rdp}, flash 全 0xFF`);
  ok(r[0] === ACK && dev.rdp === 0, '降级命令本身成功 (ACK×2)');
  const dump = readMem(dev, FLASH_BASE, 16);
  ok(dump[0] === ACK && dump.slice(1).every(b => b === 0xFF), '降级后能读, 但只剩 0xFF: 原固件已随降级擦除');
  console.log('    → 正常路径下 RDP1→RDP0 不是绕过: 厂商用"自毁"换"保密"');
}

// ---------- Demo 5: 毛刺模型 (WOOT'20 / picopwner 的机理) ----------
h1('Demo 5 — 电压毛刺跳过 RDP 检查(机理级模型,非电路仿真)');
{
  const glitched = new Stm32Target({ rdp: 1, glitchSkipsRdpCheck: true });
  const rr = readMem(glitched, FLASH_BASE, 64);
  const secretAt = rr.indexOf(0x53);
  const secret = secretAt >= 0 ? Buffer.from(rr.slice(secretAt, rr.indexOf(0x00, secretAt))).toString('latin1') : '(未找到)';
  console.log(`    同样 RDP=1, 但 RDP 比较被毛刺跳过:\n      Read → ACK + 数据, 字符串 "${secret}"`);
  ok(rr[0] === ACK && secret.startsWith('SECRET='), '毛刺命中时受保护固件完整外泄');
  const normal = new Stm32Target({ rdp: 1 });
  ok(readMem(normal, FLASH_BASE, 16)[0] === NACK, '对照: 同一时刻未毛刺的器件仍拒绝 (毛刺是时序窗口, 不是开关)');
  console.log(`    → 现实中: WOOT'20 用电压毛刺+FPB 在真芯片上实现了这一点;`);
  console.log(`      picopwner 把成本降到一只树莓派 Pico; 详见 knowledge/01 #3/#22`);
}

// ---------- 总结 ----------
h1('总结');
console.log(`    通过 ${pass} 项, 失败 ${fail} 项`);
console.log(`
    攻击含义(对照 knowledge/01 / 02):
    * 不到 20 元的 USB-TTL + AN3155 协议 = 未保护 STM32 的完整固件提取器
    * RDP1 挡住的是"协议层", 挡不住"物理层"(毛刺打比较指令)
    * RDP 降级即自毁 —— 所以真实攻击都瞄准"检查的执行"而非"标志位"
    * 防御对照: RDP2(不可逆)/flash 加密 + 密钥在 eFuse, 见 knowledge/03 #14`);
process.exit(fail === 0 ? 0 : 1);
