---
name: emb-auto-router
description: "嵌入式/IoT/汽车硬件攻击研究总入口与场景路由。任何涉及调试接口(JTAG/SWD/UART)、固件提取、读保护绕过(RDP/APPROTECT)、IoT SoC 平台攻击(ESP32/RP2350/nRF52)、CAN 总线、UDS 诊断、ECU/车机、无钥匙进入(PKES/KeeLoq/Hitag2)的硬件安全评估、授权渗透测试或安全研究问题,先加载本技能判断攻击面类型并路由到具体子技能。不适用于功耗/电磁/计时等侧信道(走 sca-router)与纯软件 Web/API 漏洞。关键词: hardware hacking, 硬件攻击, 嵌入式安全, IoT security, automotive security, 汽车安全, 调试口, 固件提取, CAN bus, UDS, 攻击面路由。"
---

# 嵌入式/IoT/汽车硬件攻击路由

## 使用本技能的方式

先按"接触模型"和"目标类型"两维定位,再进入具体子技能。引用文献前必查对应知识域 README 的"纠错"小节(本项目核实过大量常见误引)。

## 路由表

| 场景特征 | 路由到 | 知识库 |
|---|---|---|
| 板子在手,想找接口/引脚(TX/RX/CLK/测试点) | `emb-uart-spi-i2c-recon` | knowledge/01 |
| 有 JTAG/SWD 口,想 halt CPU/读内存/识别器件 | `emb-jtag-swd` | knowledge/01 |
| flash 有读保护(RDP/APPROTECT),想拿固件 | `emb-readout-protection` | knowledge/01 |
| 想从设备提取固件并解包分析(binwalk/EMBA) | `emb-firmware-extraction` | knowledge/02 |
| 目标是特定 SoC 平台(ESP32/RP2350/nRF52/STM32 克隆) | `emb-iot-soc-cases` | knowledge/03 |
| 目标是车辆/CAN 总线(注入/DoS/bus-off/侦察) | `auto-can-attack` | knowledge/04 |
| 目标是诊断口/ECU 软件(UDS 0x27/0x22/刷写) | `auto-uds-diagnostics` | knowledge/05 |
| 目标是车机/Telematics/远程攻击面 | `auto-ecu-ivi` | knowledge/05 |
| 目标是车钥匙/无钥匙进入(RKE/PKES/滚码) | `auto-keyless-rke` | knowledge/05 |
| 攻击现象是"功耗/电磁/时间泄漏密钥" | 换 `sca-router`(姊妹技能库) | side-channel-research |
| 攻击手段是电压/电磁毛刺本身(非读保护场景) | 本库仅在各子技能内引用;FI 专项调研未完成,勿编造 | — |

## 接触模型速判

- **物理接触(壳都拆了)**: 01/02/03 域——调试口 → 固件 → 平台漏洞,顺序执行;50 元的 USB-TTL 就能开始。
- **仅 OBD-II 口接触**: 04/05 域——被动监听 → 功能寻址枚举 → UDS 认证面;注意授权与法规边界。
- **无物理接触(远程)**: 05 域(车联网/Telematics/API)——Checkoway'11 与 Curry 2023 两条历史线。
- **无线电接触(钥匙/中继)**: `auto-keyless-rke`。

## 全局纪律(不可跳过)

1. 授权边界: 只对自有设备/书面授权目标做主动实验;公共道路上任何主动注入在绝大多数司法辖区违法(详见 knowledge/06 纪律节)。
2. 真实性纪律: 引用文献查"纠错"小节;标注 [未验证]/存疑的内容不得作为事实或攻击依据。
3. 复现优先: 协议级机理先跑 `embedded-auto-research/reproductions/` 三个实验再上硬件。

## 工具/标准/社区总览

装备预算分层(入门 $50-150 → 专业 $2k+)、标准速查(ISO 11898/14229/21434、UNECE R155)、社区入口(hardwear.io、DEF CON CHV/IoT Village、ESCAR、Pwn2Own Automotive): 全部在 knowledge/06。
