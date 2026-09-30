---
name: emb-uart-spi-i2c-recon
description: "硬件侦察三板斧:UART 引脚识别与 root shell 获取(波特率猜测/boot log)、SPI NOR/NAND flash 直读(flashrom+SOIC 夹具/脱焊)、I2C EEPROM/传感器/PMIC 总线嗅探与枚举。适用于嵌入式设备物理接触后的第一步侦察、量产板接口残留审计、二手设备数据残留取证。不适用于 JTAG/SWD(emb-jtag-swd)或芯片自带 bootROM 下载器的提取(emb-firmware-extraction)。关键词: UART, SPI, I2C, flash dump, flashrom, SOIC8 夹具, 逻辑分析仪, root shell, boot log, 侦察, 引脚识别, eMMC,EEPROM。"
---

# UART / SPI / I2C 侦察

## 适用场景与不适用场景

**适用**:
- 拆开设备后的第一小时: 找接口、认芯片、判断"下一步走哪条路"
- 目标固件在外部 SPI flash(路由器/摄像头/PLC 常见)——与 SoC 安全状态无关,拆了就能读
- 二手设备数据残留取证(智能家居前主人的口令/SSID/云端 token)

**不适用**:
- 芯片有 UART/SPI 自举下载器(STM32 等)→ `emb-firmware-extraction`(不用拆,协议更稳)
- 片内 flash 且有读保护 → `emb-readout-protection`
- JTAG/SWD 调试口 → `emb-jtag-swd`

## 前置条件

- 入门层装备即可开工(knowledge/06 预算分层): 万用表、USB-UART(CP2102/FT232)、8 通道逻辑分析仪、SOIC8 测试夹、编程器(CH341 类)或 Tigard/Bus Pirate、杜邦线
- 软件: flashrom、binwalk(解包转 `emb-firmware-extraction`)、screen/minicom

## 方法学步骤

1. **PCB 考古**: 拍照记录 → 认芯片(丝印查手册: SoC 型号/flash 型号/PMIC)→ 找测试点、排针、空焊盘、丝印(TX/RX/CLK/IO/GND)。分清板版本(Rev)。
2. **供电与地**: 万用表通断档找 GND(与 USB 外壳/大电容地通);量 VCC(3.3V 常见)。**上电前必做**。
3. **UART 三步**(VoidStar 方法论, knowledge/01 #18):
   a. 找 TX: 上电瞬间该引脚有 burst(boot log);空闲时高电平;RX 短接到地不炸。
   b. 猜波特率: 逻辑分析仪抓 burst 自动解码,或从 115200/57600/38400/9600 逐个试。
   c. 读 boot log: 量产固件的 log 常直接打印调试信息;焊 RX 看 prompt,回车试 shell——root shell 就此到手(dd/mtd 提取转 `emb-firmware-extraction`)。
4. **SPI flash 直读**:
   a. 识别 flash 型号(丝印: W25Q128/MX25L/GD25Q 等)。
   b. in-circuit 读: SOIC8 夹具夹芯片 + flashrom(注意板载供电会干扰,必要时只给夹具供电/按住复位让 SoC 不驱动总线);读不动就 c。
   c. 脱焊读: 热风枪取下,编程器读,**读两遍校验一致**再装回。
5. **I2C 枚举**: 总线 CLK/DATA 上挂的器件地址扫描(逻辑分析仪或 Bus Pirate scan);EEPROM(24Cxx)读配置/序列号/校准数据;PMIC 寄存器读取常能改电压(为毛刺做准备,衔接 `emb-readout-protection`)。
6. **eMMC 大容量场景**: eMMC 转 SD 座按 SD 协议直读(boot 分区 + RPMB 注意 RPMB 有密钥保护)。
7. **产出**: 接口映射表 + flash dump + 初步 binwalk 结果,交下一环节。

## 关键细节与常见坑

- UART 无响应先查共地与波特率,再怀疑"已禁用";有些设备 TX 只在特定启动阶段输出——上电瞬间盯紧。
- in-circuit 读 SPI 失败的最常见原因: SoC 仍在驱动总线(按住 reset/擦除脚)或夹具接触不良——先换接触再脱焊,脱焊是最后手段(有损)。
- flash 容量比标称大(预留区)属正常;读出全 0xFF/全 0x00 检查读的是否是错误布局。
- I2C 上拉电阻在板上,脱焊单读 EEPROM 时自己补上拉。
- 逻辑分析仪克隆(8ch)足够 UART/SPI;上 CAN/高速信号再考虑更好的设备。
- **法务**: 二手设备取证注意隐私法规;数据残留研究以自购设备为限(knowledge/06 纪律)。

## 参考实现与工具

- `embedded-auto-research/reproductions/stm32_bootloader.js` 的 UART 组包/校验部分——理解串行协议帧的校验规则怎么验证
- flashrom / binwalk / Bus Pirate 5 / Tigard / Glasgow / HydraBus——knowledge/01 工具表(含 star 快照)
- Dennis Giese DEF CON 27 IoT Village 演讲——二手设备数据残留的系统化案例 [高]

## 已验证参考文献(引用前查 knowledge/01 纠错节)

- VoidStar Security, "Router Analysis Part 1: UART Discovery and SPI Flash"(TP-Link Archer A7 全流程) [高]
- Riverloop Security, "Hardware Hacking 101"(JTAG/接口识别系列) [高]
- Hackaday, "A Hacker's Guide To JTAG"(2020)与 "The Many Faces Of JTAG"(2016) [高]
- Praetorian, "JTAGulator vs. JTAGenum"(引脚枚举工具对比) [高]
- van Woudenberg & O'Flynn《The Hardware Hacking Handbook》存储器与接口章节 [高]
