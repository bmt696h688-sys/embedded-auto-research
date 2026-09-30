---
name: emb-jtag-swd
description: "JTAG(IEEE 1149.1)/SWD 调试接口攻击:TAP 状态机、IDCODE 扫描链枚举、BYPASS 链长测量、OpenOCD halt CPU 后 dump RAM/flash 提取口令密钥、引脚识别(JTAGulator/JTAGenum)、ST-Link/J-Link 探针自身漏洞。适用于嵌入式设备物理安全评估、授权渗透测试、量产板残留调试口审计。不适用于无调试口的固件提取(emb-firmware-extraction)或读保护已生效的场景(emb-readout-protection)。关键词: JTAG, SWD, TAP, IEEE 1149.1, IDCODE, BYPASS, OpenOCD, JTAGulator, 调试口, halt CPU, dump memory, 片上调试。"
---

# JTAG/SWD 调试接口攻击

## 适用场景与不适用场景

**适用**:
- 物理接触目标板,板上留有(或疑似留有)JTAG/SWD 测试点、排针、空焊盘
- 目标是读固件、读 RAM 中的口令/密钥(设备运行后敏感数据常驻内存)
- 审计量产板"调试口是否残留/是否上锁"

**不适用**:
- 调试口已熔断/锁死 → 转 `emb-readout-protection`(毛刺)或 `emb-firmware-extraction`(外部 flash 直读)
- 引脚未知但接口是 UART/SPI/I2C → `emb-uart-spi-i2c-recon`

## 前置条件

- 硬件: 多协议工具(ST-Link 克隆≈$5 / Tigard / Shikra / Glasgow / JTAGulator);万用表;逻辑分析仪
- 软件: OpenOCD(中枢)、GDB(可选)
- 协议内核理解: 跑 `embedded-auto-research/reproductions/jtag_tap.js`(16 态状态机/IDCODE/BYPASS 全仿真,13 项断言)

## 方法学步骤

1. **引脚识别**: 万用表找 VCC/GND → JTAGenum(Arduino/RPi,免预算)或 JTAGulator($100-200,24 通道自动扫 IDCODE/BYPASS);丝印/过孔/测试点按 01 域教程人工判读。UART 找 TX(空闲高电平)。
2. **链枚举**(无文档时): TAP 复位(5×TMS=1)→ Shift-DR 读 IDCODE → 解码 version/part/manufacturer 查器件型号;装全 1 的 IR(BYPASS)后打入标记位测链长(数器件)。机理见 jtag_tap.js Demo 1/2。
3. **接调试服务器**: OpenOCD 配 target(按识别出的型号)→ `init; halt` → `dump_image` / `mdw` 读内存;SWD 场景走 SW-DP→Mem-AP 直访内存(2 线)。
4. **内存狩猎**: 重点: 运行时 RAM(口令/会话 token/密钥材料)、flash、外设寄存器(如 WiFi SOC 的密钥寄存器)。Portcullis BroadLink 案例: OpenOCD halt 后在 RAM 直接搜出 Wi-Fi 口令(knowledge/01 #17)。
5. **边界确认**: RDP/APPROTECT 等锁生效时 OpenOCD 拒连/读回全错——此时转 `emb-readout-protection`,不要反复重试。
6. **记录**: 引脚映射、器件 IDCODE、dump 校验和,形成可复现的审计证据。

## 关键细节与常见坑

- **TAP 状态机是内核**: 16 态转移表、Capture-IR 低 2 位=01、BYPASS=全 1——工具报错时先想状态走错(Ex1 态 TMS=1 才进 Update;`[1,0,0,0]` 之类导航序列错一步全程错位)。
- IDCODE bit0 恒为 1: 读到全 0/全 1 说明链上无 IDCODE 或连接错误,不是"隐藏器件"。
- SWD 与 JTAG 同源: ARM SW-DP/ADIv5 只是 2 线封装,Mem-AP 直访内存的杀伤力等同;nRF52 的 SWD 复活(APPROTECT 毛刺)见 `emb-readout-protection`。
- **探针自身也是攻击面**: ST-Link V2-1 固件缓冲区溢出(GMMan 分析)、J-Link 克隆被官方固件检测变砖(Segger 反克隆,2015→2020)——给客户做评估时你的工具链也要可信。
- EXTEST(边界扫描)可直接驱动/采样引脚,绕过 SoC 逻辑——对"不碰 CPU 也想动物理信号"的场景有用。
- 星数/工具选型以 knowledge/01 工具表快照为准。

## 参考实现与工具

- `embedded-auto-research/reproductions/jtag_tap.js`——TAP 状态机/IDCODE/BYPASS 链长仿真(含状态转移表自检 KAT)
- OpenOCD / stlink / JTAGulator(grandideastudio,EXPLIoT 制造)/ JTAGenum(cyphunk)/ Glasgow / Tigard / Shikra / Bus Pirate 5 / ESP32-Bit-Pirate——均经仓库实访验证,star 快照见 knowledge/01 工具表

## 已验证参考文献(引用前查 knowledge/01 纠错节)

- Rosenfeld & Karri, "Attacks and Defenses for JTAG", IEEE Design & Test 27(1):36-47, 2010——奠基综述 [高]
- Obermaier 等, WOOT'17(STM32F0 读保护)与 WOOT'20(STM32F1 及替换/仿冒芯片)——**注意两篇常被混引** [高]
- Tan 等, "SoK: Where's the 'up'?!", WOOT'24——Cortex-M 系统化(689 芯片+1797 固件) [高]
- Portcullis "JTAG on-chip debugging: Extracting passwords from memory"(BroadLink RM Pro 实战) [高]
- VoidStar "Router Analysis Part 1"(万用表+逻辑分析仪找 UART 的方法论) [高]
- hardwear.io USA 2025: "Journey Into JTAG"(高通 APQ8064)与 "STM32-TraceRip"(trace 口提 RDP 保护固件) [高]
- Goodspeed《Microcontroller Exploits》(2024)、van Woudenberg & O'Flynn《The Hardware Hacking Handbook》(2021) [高]
