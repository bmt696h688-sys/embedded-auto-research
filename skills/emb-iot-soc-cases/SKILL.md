---
name: emb-iot-soc-cases
description: "IoT/SoC 平台攻击案例库:ESP32(毛刺三部曲 FaultPWN/FBSB、Raelize crowbar、2025 隐藏命令事件与重新定性)、RP2350 官方攻击挑战(Optiglitch/hextree 双毛刺/ROM 修订修复)、nRF52 APPROTECT、STM32 商品化解密现象、Starlink 终端故障注入、DJI 固件解密、各平台安全机制(flash encryption/secure boot v2/OTP)对照。适用于按平台检索攻击先例、评估目标设备所用 SoC 的已知攻击面。不适用于通用方法论(走对应方法技能)或未收录平台(检索复核而非编造)。关键词: ESP32, RP2350, RP2040, nRF52, STM32, SoC attack, secure boot bypass, flash encryption, Optiglitch, hextree, Starlink hack, LimitedResults, 平台漏洞, IoT hacking。"
---

# IoT/SoC 平台攻击案例

## 适用场景与不适用场景

**适用**:
- 目标设备用已知平台(ESP32/RP2040/RP2350/nRF52/STM32/Zynq),想知道"这个平台已经被打成什么样"
- 选型/威胁建模: 评估某 SoC 的 secure boot/flash encryption 实际强度
- 写报告时需要可引用的攻击先例(含官方承认的挑战结果)

**不适用**:
- 要通用方法论(引脚侦察/提取/毛刺)→ 对应方法技能
- 平台未收录: 检索验证后引用,**不得把相似平台结论外推**(03 域纠错 #2 的教训)

## 平台速查表(细节与出处见 knowledge/03)

| 平台 | 安全机制 | 已验证的代表攻击 | 关键出处 |
|---|---|---|---|
| ESP32 | flash encryption + secure boot v2(eFuse) | 电压毛刺连破 AES(FaultPWN)/secure boot(FBSB)/flash encryption;crowbar 工程化复现 | LimitedResults 三部曲、Raelize [高] |
| RP2040 | **无 secure boot/无读保护**(flash 在片外) | 拿到板子=拿到固件,无需攻击 | 官方文档性质 [高] |
| RP2350 | OTP/secure boot/毛刺检测器 | 官方挑战多项毛刺攻击获奖(含绕过毛刺检测器的双毛刺);后续 ROM 修订修复 | Raspberry Pi 官方战报 [高(事件)] |
| nRF52 | APPROTECT | 上电时序毛刺复活 SWD → Mem-AP 提固件 | LimitedResults 2020 [高] |
| STM32 | RDP1/RDP2 | WOOT'17/'20 → picopwner/SECGlitcher/Anvil;2025 出现二手市场"解密服务"现象(未验证条目) | 见 `emb-readout-protection` |
| Zynq | 启动链/bitstream 加密 | 启动链漏洞 CVE-2022-23822(细节待复核) | NVD [中] |
| Starlink 终端 | 签名校验 | 电压毛刺打签名验证,自制 modchip 运行任意代码 | Wouters, BH 2023 [高(事件)] |

## 使用步骤

1. **识别平台**: 从丝印/固件/IDCODE 确定目标 SoC 与修订版(boot ROM 版本影响已修复漏洞的适用性)。
2. **查案例**: 在上表与 knowledge/03 资源清单定位先例,注意每条的**置信度标注**——"未验证(已隔离)"条目(Nest Wifi Pro 提权链、闲鱼解密、RP2350 E 编号细节)不得作为事实引用。
3. **读对照面**: 攻击对应的防御文档(Espressif flash encryption/secure boot v2 文档、RP2350 手册安全章、nRF52 APPROTECT 说明)——确认目标设备的配置是否开启了相应机制(默认常是关的)。
4. **评估适用性**: 检查修复状态(RP2350 的获奖攻击已在 E25 修订修复——新批次芯片上复现会失败);检查你的固件版本与目标配置。
5. **选路线**: 平台漏洞优先于自研毛刺——已有公开复现(stm32f1-picopwner/hextree 教学等)直接照做,注意参数只对特定修订有效。

## 关键细节与常见坑

- **"ESP32 有后门"(2025)是失真传播**: 实为未公开的厂商调试 HCI 命令,利用前提苛刻(近距离蓝牙),Espressif 已评估——引用必须按重新定性后的结论(knowledge/03 纠错 #1);CVE 编号未钉死,引用前查 NVD。
- **RP2040 ≠ RP2350**: 前者无任何启动保护;后者才有 OTP/secure boot/毛刺检测——两个芯片的案例不可互换。
- **Starlink 攻击与 Tesla 钥匙攻击同作者(Lennert Wouters)**: 不同工作,别合并引用。
- 毛刺检测器不是无敌: RP2350 挑战证明"双毛刺"可绕过——防御机制的绕过本身会成为新案例。
- SoK WOOT'24(689 颗 Cortex-M 统计)是把个案放回全景的最佳锚点。

## 参考实现与工具

- `embedded-auto-research/reproductions/jtag_tap.js` + `stm32_bootloader.js`——平台攻击的协议级底座
- Espressif 官方安全文档(docs.espressif.com)——flash encryption/secure boot v2 权威定义 [高]
- RP2350 datasheet(datasheets.raspberrypi.com)——OTP/毛刺检测器设计 [中(URL 模式推断)]

## 已验证参考文献(knowledge/03, 引用前查纠错节)

- LimitedResults ESP32 三部曲 + nRF52 复活系列 [高]
- Raspberry Pi RP2350 官方攻击挑战公告与结果(2024-2025) [高(事件)/细节中]
- Wouters, Starlink 用户终端故障注入, Black Hat USA 2023 [高]
- Tan 等, SoK Cortex-M, WOOT'24 [高]
- Goodspeed,《Microcontroller Exploits》案例章(Ledger Nano S 等) [高]
- Tarlogic ESP32 披露(2025)——按"重新定性"引用 [高(事件)/CVE 中]
