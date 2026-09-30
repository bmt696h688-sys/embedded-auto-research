---
name: emb-firmware-extraction
description: "固件提取与解包全流程:bootROM 自举协议(STM32 AN3155/AN2606、esptool、mtkclient)、SPI/eMMC 直读衔接、binwalk/unblob 解包(sasquatch/jefferson/ubi_reader)、EMBA/FACT 自动化分析、firmadyne 仿真、OWASP FSTM 方法论、binwalk 自身漏洞(CVE-2022-4510)与解包卫生。适用于 IoT/嵌入式设备固件获取、漏洞挖掘前置、供应链安全研究。不适用于固件已加密且密钥不可得(转平台攻击 emb-iot-soc-cases)或读保护芯片(emb-readout-protection)。关键词: firmware extraction, 固件提取, binwalk, AN3155, bootloader, esptool, mtkclient, EMBA, FACT, firmadyne, 解包, 文件系统, squashfs, OWASP FSTM。"
---

# 固件提取与解包

## 适用场景与不适用场景

**适用**:
- 拿到设备后的"固件从哪来"问题: 官网升级包 / 自举协议读取 / flash 直读 / 运行时导出
- 拿到镜像后的"怎么打开": 文件系统提取、敏感信息扫描、自动化分析、仿真
- 漏洞挖掘/密钥审计/供应链研究的第一英里

**不适用**:
- 芯片读保护拦路 → `emb-readout-protection`
- 固件加密且密钥在 SoC 内 → `emb-iot-soc-cases`(打平台漏洞)
- 提取后想找密码学实现缺陷(侧信道) → sca 系列

## 前置条件

- 协议层理解: 跑 `embedded-auto-research/reproductions/stm32_bootloader.js`(AN3155 全命令仿真)
- 工具: binwalk + sasquatch(非标 squashfs)/ unblob / firmwalker / EMBA 或 FACT / Ghidra;硬件侧见 `emb-uart-spi-i2c-recon`
- 隔离环境: 虚拟机/容器(解包不可信固件有真实风险,见坑 #1)

## 方法学步骤(按获取渠道)

1. **先找现成的**: 厂商官网/support 的固件升级包(常是完整或差分镜像)——零成本第一选择;没有再上硬件。
2. **bootROM 自举提取**(芯片自己的下载器,最干净):
   - STM32: 查 AN2606 确认自举引脚配置 → BOOT0=1 进自举 → USB-TTL 按 AN3155 走 0x7F 同步→Get→GetID→Read Memory(协议细节与校验规则见 stm32_bootloader.js);主机工具 stm32flash/CubeProgrammer
   - Espressif: esptool read_flash(注意 flash encryption 开启时读出为密文)
   - MediaTek: mtkclient(BROM 漏洞链: amonet/kamakiri 的工程化后代)
3. **外部存储器直读**: SPI NOR(SOIC 夹具/脱焊+flashrom)、eMMC(转 SD 座)——见侦察技能。
4. **运行时提取**: UART root shell → dd /dev/mtd*;或调试口 dump(emb-jtag-swd)。
5. **解包初析**:
   a. `binwalk -e`(签名扫描+递归提取;非标 squashfs 需要 sasquatch;JFFS2→jefferson;UBI→ubi_reader;熵分析识别加密/压缩区)
   b. `unblob`(确定性、可审计,处理 binwalk 盲区)
   c. firmwalker 扫敏感信息: 口令、私钥、证书、API key、硬编码端点
6. **自动化深度分析**: EMBA(全流程: 内核配置审计/CVE 匹配/多探测器)或 FACT(插件化+版本对比)
7. **动态分析(可选)**: firmadyne/FirmAE 把 Linux 固件跑进 QEMU,上去跑 Nmap/漏洞扫描
8. **流程化交付**: 按 OWASP FSTM 九步(信息收集→获取→分析→漏洞验证)组织报告

## 关键细节与常见坑

- **解包=执行攻击面**: binwalk 旧版路径穿越(CVE-2022-4510)与历史上多个提取器 RCE——**永远在隔离环境解不可信固件**,升级到当前版本(受影响区间以 NVD/GHSA 为准,knowledge/02 #9)。
- AN3155 校验规则: 命令/读计数=按位取反;地址 3 字节 XOR;写数据=整体 XOR——校验错就 NACK,别怪线。
- 自举读取受 RDP 拦截(协议层),毛刺路线见 `emb-readout-protection`。
- squashfs 解不开: 先怀疑非标魔数/压缩参数(sasquatch 就是为此打补丁),再怀疑加密(熵≈7.99/8)。
- 固件版本与板版本要对应——错版固件分析浪费时间且误导结论。
- Costin'14 大规模研究的教训: 硬编码密钥/后门账户/过时组件是系统性现象,不是个案——扫描规则要全(entropy+字符串+证书+配置)。

## 参考实现与工具

- `embedded-auto-research/reproductions/stm32_bootloader.js`——AN3155 协议级全流程(含 RDP 门禁与地址建模说明)
- binwalk(ReFirmLabs)/ unblob(onekey-sec)/ EMBA(e-m-b-a)/ FACT(fkie-cad)/ esptool/ mtkclient/ stm32flash/ firmadyne——knowledge/02 工具表(均经仓库实访)

## 已验证参考文献(引用前查 knowledge/02 纠错节)

- ST AN3155 / AN4286 / AN2606——自举协议/引脚配置第一手规范 [高]
- Costin, Zaddach, Francillon, Balzarotti, "A Large-Scale Analysis of the Security of Embedded Firmwares", USENIX Security 2014——大规模固件安全开山 [高]
- Chen, Woo, Brumley, Egele, "Towards Automated Dynamic Analysis of Linux-based Embedded Firmware", NDSS 2016(firmadyne) [高]
- Zaddach 等, "Avatar", NDSS 2014——外设代理式动态分析 [高]
- OWASP FSTM——固件测试方法论 [高]
