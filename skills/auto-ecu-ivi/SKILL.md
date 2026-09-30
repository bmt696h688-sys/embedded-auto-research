---
name: auto-ecu-ivi
description: "ECU 固件提取与车机(IVI)/Telematics/远程攻击面:OBD 刷写链提取 ECU 固件、车机 Android Automotive/QNX 逆向、Telematics 盒与 OBD dongle 作为远程跳板(Checkoway'11→ESORICS'18)、云端 API 攻击(Sam Curry 2023 Web Hackers vs The Auto Industry)、Pwn2Own Automotive 历届战果(2024-2026 数字已核实)、Keen Lab Tesla 远程研究、ISO/SAE 21434 与 UNECE R155 合规语境。适用于整车远程攻击面评估、车联网安全审计、行业攻击面趋势分析。不适用于诊断协议细节(auto-uds-diagnostics)、CAN 链路(auto-can-attack)、车钥匙(auto-keyless-rke)。关键词: ECU firmware, 车机, IVI, infotainment, telematics, OBD dongle, connected car, automotive API, Pwn2Own, Tesla hack, Keen Lab, ISO 21434, UNECE R155, 车联网。"
---

# ECU/车机与远程攻击面

## 适用场景与不适用场景

**适用**:
- 评估"从互联网到 CAN"的完整远程路径: 云 API → Telematics → 车机/网关 → 总线
- 提取与分析 ECU/车机固件(刷写链/调试口)
- 行业攻击面趋势研究(Pwn2Own 战果分析、合规对标)

**不适用**:
- 诊断服务层 → `auto-uds-diagnostics`;CAN 链路层 → `auto-can-attack`;钥匙 → `auto-keyless-rke`
- 纯动力/功能安全话题(ISO 26262 是 safety,不是 security,引用勿混)

## 远程路径地图(二十年演进)

```
Checkoway'11 (蓝牙/无线电/Telematics 直达 CAN)
   → OBD dongle 时代 (ESORICS'18 Beneath the Bonnet: 遥测狗=蜂窝跳板)
   → Jeep 2015 (Uconnect 蜂窝系统, 140 万召回)
   → Keen Lab 2016/17 (Model S/X 远程控制)
   → 云 API 时代 (Curry 2023: 账号接管/远程开锁启动)
   → Pwn2Own Automotive 2024-2026 (车机/充电桩/Tesla Wall Connector)
```

## 方法学步骤

1. **攻击面清点**: 车型/架构调研——远程通信单元(TCU)型号、车机 OS(Android Automotive/QNX/Linux)、手机 App 与云 API、OBD 接口暴露、WiFi/蓝牙。ISO/SAE 21434 的 TARA 是现成框架。
2. **云端/API 层**(Curry 2023 路线): App 抓包 → API 枚举 → 越权(IDOR: 换 VIN/userId 看别人车辆)、token/密钥管理缺陷、账号体系重置流程——当代最高产出的层;发现按 GDPR/责任披露处理。
3. **Telematics/车机**: 固件获取(OTA 包/TCP 诊断口/拆机 eMMC——衔接 `emb-firmware-extraction` 与 `emb-uart-spi-i2c-recon`);Android Automotive 提 APK 审组件导出/WebView/签名校验;QNX 走 ELF 逆向(Ghidra)。
4. **ECU 固件(经由诊断口)**: 0x34-0x37 刷写面与厂商刷写工具(逆向其协议/密钥)提取;部分 ECU 经 CCP/XCP 可 dump(授权环境)。
5. **跳板链验证**: 从外部接口到 CAN 的每一跳都要实证(不能"理论上可达");Pwn2Own 获奖研究的公开材料(TCHES/演讲)是最强佐证模板。
6. **合规对标**: 结论映射到 UNECE R155 CSMS 要求(54 国型式认证)与 ISO/SAE 21434 流程节点——给 OEM/Tier1 的报告用他们的语言。

## 关键细节与常见坑

- **Pwn2Own Automotive 数字(已核实, 引用别抄错)**: 2024=49 个 0day/$1,323,750;2025=49 个/$886,250;2026=76 个/$1,047,000(ZDI 官方博客实访, knowledge/05 纠错 #1)。
- Curry 2023 是**云端/API**研究,不是"黑进车里的电脑"——媒体转述常夸大为整车控制;引用按原文范围(账号/远程功能)。
- Keen Lab Tesla 研究(2016-2017)官方致谢多源可信,但实验室官网具体报告 URL 未逐条核(knowledge/05 存疑 #9)。
- 车机提取注意数据残留(前车主隐私)与车机激活锁——拆机车≠研究车。
- OBD dongle 是被低估的中间层: 它自己就是一台连 4G 的 Linux 设备(算力弱、更新少),常同时是跳板和靶子。
- **J1939 重载车辆**: 协议族(SAE J1939)与乘用车 UDS 生态完全不同,工具链与文献别混用。

## 参考实现与工具

- `embedded-auto-research/reproductions/can_uds_sim.js`——远程路径的"最后一跳"(总线+诊断)仿真
- 提取/逆向工具链见 `emb-firmware-extraction`;Ghidra(ARM/PowerPC/QNX ELF)
- Pwn2Own 战报入口: zerodayinitiative.com/blog

## 已验证参考文献(引用前查 knowledge/05 纠错节)

- Checkoway 等, USENIX Security 2011——攻击面全景开山 [高]
- Miller & Valasek, S&P 2015——Jeep 远程控制 [高]
- Curry 等, "Web Hackers vs. The Auto Industry", 2023 [高]
- Beneath the Bonnet, ESORICS 2018 [中(题录待复核)]
- Wouters 等, TCHES 2019/2021——Tesla 钥匙(衔接 `auto-keyless-rke`)
- Keen Lab Tesla 报告(2016-17) [中(细节)]
- ISO/SAE 21434:2021 / UNECE R155/R156 [高]
- Pwn2Own Automotive 2024/2025/2026 战报(ZDI) [高]
