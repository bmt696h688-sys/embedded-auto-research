---
name: emb-readout-protection
description: "MCU 读保护绕过:STM32 RDP(L0/L1/L2 分级与降级自毁)、nRF52 APPROTECT 复活(上电毛刺)、电压毛刺攻击选项字节比较(WOOT'17/'20 谱系)、平价复现平台(stm32f1-picopwner 用一只 Pico、PicoGlitcher、ChipWhisperer crowbar)、2024-2025 工程化复现(SECGlitcher/Anvil)与 trace 路线(STM32-TraceRip)。适用于授权渗透测试中固件受读保护保护的场景、芯片安全概念评估。不适用于无保护芯片(直接 dump)或外部 flash(直接读)。关键词: RDP, readout protection, APPROTECT, 读保护, 电压毛刺, voltage glitching, crowbar, WOOT, picopwner, SECGlitcher, STM32, nRF52, fault injection。"
---

# 读保护绕过(RDP / APPROTECT)

## 适用场景与不适用场景

**适用**:
- 目标 MCU 有固件读保护(STM32 RDP1/RDP2、nRF52 APPROTECT、同类 vendor lock),固件是核心资产
- 评估"该芯片的读保护在物理攻击者面前的实际强度"
- 授权渗透测试需要提取固件做后续漏洞分析

**不适用**:
- 未设保护的芯片(直接 OpenOCD/自举协议 dump,见 `emb-jtag-swd`/`emb-firmware-extraction`)
- 固件在外部 SPI flash(与芯片保护无关,直读,见 `emb-uart-spi-i2c-recon`)
- 毛刺攻击需要明确的授权与法律边界——只对自有/授权目标做

## 保护机制速查(先搞清对手是什么)

| 保护 | 芯片 | 语义 | 已知攻击面 |
|---|---|---|---|
| RDP0(AA) | STM32 | 无保护 | 直接读 |
| RDP1 | STM32 | 调试口/自举读禁止;**降级到 RDP0 触发全片擦除** | 毛刺跳过"选项字节比较"(WOOT'20 谱系) |
| RDP2 | STM32 | 永久(设计上不可降级) | 毛刺降级 RDP2→RDP1(SECGlitcher Part 2 方向);TraceRip 走 trace 口 |
| APPROTECT | nRF52 | 调试口关闭 | 上电/复位时序毛刺使 APPROTECT 失效(LimitedResults 2020) |

## 方法学步骤(工程路线)

1. **确认现状**: 自举协议/调试口连上看报什么(全 NACK/读全错)——先确定保护级别,再选路线。
2. **机理理解**: 跑 `embedded-auto-research/reproductions/stm32_bootloader.js`——RDP 门禁在协议层怎么生效、为什么降级=自毁、毛刺跳过比较时发生什么(Demo 3-5)。
3. **选毛刺平台**(按预算, knowledge/06):
   - 数美元: stm32f1-picopwner(RP2040,专打 STM32F1 RDP1,WOOT'20 复现)
   - €60-120: PicoGlitcher(RP2040 通用毛刺器,faultyhardware.de)
   - ~$300: ChipWhisperer-Lite(crowbar 电路,参数化扫描)
4. **参数扫描**: 毛刺宽度/延迟/电压档逐维搜,从"复位后固定窗口"开始(选项字节比较发生在启动早期);命中标志是 NACK 变 ACK 或保护状态突变。SECGlitcher 实测: STM32F429 bootloader 阶段 622 次成功毛刺 dump 155KB(通宵量级);Anvil: F401 约 6 小时提全片。
5. **验证产出**: dump 首尾校验、向量表合理性、与已知字符串比对——毛刺攻击的"成功"要靠数据自证。
6. **nRF52 路线**: APPROTECT 复活打的是上电时序(DEC1 掉电窗口),复现参照 LimitedResults Part 1/2(含 OpenOCD 脚本)。

## 关键细节与常见坑

- **降级不是绕过**: RDP1→RDP0 的正常路径伴随全片擦除——拿到固件的唯一"正常"路径是毛刺跳过检查,不是改回 AA。
- **型号差异极大**: F0/F1/F4/L 系的选项字节编码、比较时序、bootloader 行为都不同;原厂与替换/仿冒芯片行为也不同(WOOT'20 主题)——复现结论不可跨型号外推。
- **毛刺是时序窗口不是开关**: 同一器件同一时刻未命中就仍是 NACK(can_uds_sim.js 风格的对照思维);报告命中率(尝试次数/成功次数)而非"能/不能"。
- picopwner 攻击出处是 **WOOT'20**(F1, 毛刺+FPB),不是 WOOT'17(F0, 竞态+UV-C)——两篇混引是最高频错误。
- SECGlitcher **Part 1** 演示的是 RDP1 读取与命令行认证绕过;RDP2→RDP1 降级是 Part 2 预告内容,引用别越界。
- 毛刺打到别人=破坏性风险(过压/锁死),可牺牲样本是硬前提。

## 参考实现与工具

- `embedded-auto-research/reproductions/stm32_bootloader.js`——RDP 门禁/降级自毁/毛刺机理模型(17 项断言)
- stm32f1-picopwner(CTXz)/ f103-analysis(WOOT'20 原始材料)/ PicoGlitcher(MKesenheimer)/ ChipWhisperer(newae)——均经仓库/官网实访验证

## 已验证参考文献(引用前查 knowledge/01 纠错节)

- Obermaier, Tatschner, WOOT'17——STM32F0: 竞态+UV-C 降级, CVE-2017-18347 [高]
- Obermaier, Schink, Moczek, WOOT'20——STM32F1 及替换/仿冒芯片逐颗破防 [高]
- LimitedResults, nRF52 Debug Resurrection Part 1/2(2020)+ Black Hat EU 2020 版 [高]
- SEC Consult, SECGlitcher Part 1(2024)——STM32L073 认证绕过 + F429 RDP1 dump [高]
- Anvil Secure(2025)——F401 VCAP_1 毛刺, RDP1 全片提取 [高]
- Omo & Rowley, STM32-TraceRip(hardwear.io USA 2025)——不经毛刺走 trace 提取 [高(事件)/细节待核]
- Ravi & Bhasin, NEWCAS 2025——STM32 RDP 攻防综述 [中]
