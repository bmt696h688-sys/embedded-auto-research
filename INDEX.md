# 嵌入式/IoT/汽车硬件攻击研究知识库 — 总索引

> 创建:2026-09-30 | 状态:第一阶段完成(姊妹项目:side-channel-research) | 验证体系:见 [verification/VERIFICATION.md](verification/VERIFICATION.md)

## 项目结构

```
embedded-auto-research/
├── INDEX.md                  ← 本文件
├── knowledge/                ← 经验证的知识库(按领域)
│   ├── 01-debug-interfaces/      调试接口攻击面(JTAG/SWD/UART/SPI + RDP绕过)     25条
│   ├── 02-firmware-extraction/  固件提取与解包(bootROM/直读/分析流水线)          22条
│   ├── 03-iot-soc-cases/        IoT/SoC 平台攻击案例(ESP32/RP2350/nRF52/Starlink) 18条
│   ├── 04-automotive-buses/     CAN 总线攻击(注入/DoS/bus-off/防御)              23条
│   ├── 05-automotive-ecu-ivi/   UDS/ECU/车机/无钥匙(认证/提取/Pwn2Own)           24条
│   └── 06-tools-standards-community/  工具全景/标准合规/社区/学习路径(横向索引)
├── reproductions/            ← 可复跑的复现实验(Node.js,零依赖)
│   ├── jtag_tap.js           实验1: IEEE 1149.1 TAP 状态机+IDCODE/BYPASS 链枚举
│   ├── stm32_bootloader.js   实验2: AN3155 自举协议+RDP 门禁/降级自毁/毛刺机理
│   ├── can_uds_sim.js        实验3: CAN 仲裁/bus-off + ISO-TP + UDS 四类攻击场景
│   ├── experiment_results.txt    2026-09-30 全量运行日志(54/54 断言通过)
│   └── README.md             实验方法学、结果与迭代记录(含失败过程)
├── verification/VERIFICATION.md   真实性验证报告(四层验证+纠错+隔离区)
├── skills/                   ← 技能清单(本体安装于 <工作区>/.agents/skills/,前缀 emb-/auto-)
└── ROADMAP.md                路线图(FI 专项/第二批技能/硬件复现计划)
```

## 核心数字

- **112 个编号资源条目** + 06 域工具/标准/社区全景表(约 50 项),覆盖 01-05 五大领域与横向基础设施
- **24 处常见引用错误被核实纠正**(Koscher venue、M&V 2014/2015、Pwn2Own 三届数字、KeeLoq 谱系、bus-off 论文题名、picopwner 年份、ESP32"后门"定性、Tesla 双论文等),另**26 项存疑/未验证条目已显式隔离**
- **3 个复现实验全部通过(54/54 断言)**:TAP 状态机 KAT、AN3155 校验规则与 RDP 门禁、CAN/ISO-TP/UDS 常量与四类攻击场景
- **10 个技能**(emb-auto-router 总入口 + 9 个领域技能)安装于 `<工作区>/.agents/skills/`

## 快速导航(按任务)

| 你想做什么 | 去哪里 |
|---|---|
| 从零入门嵌入式硬件攻击 | knowledge/06 十步学习路径 → knowledge/01 入门路径 → reproductions/(零硬件) |
| 拆了一台设备,下一步 | skills/emb-auto-router 按接触模型路由 → 对应领域技能 |
| 提取/分析固件 | knowledge/02 + skills/emb-firmware-extraction |
| 评估某 SoC 平台 | knowledge/03 + skills/emb-iot-soc-cases |
| 车辆相关评估 | knowledge/04/05 + skills/auto-can-attack、auto-uds-diagnostics、auto-ecu-ivi、auto-keyless-rke |
| 选装备/查标准/找社区 | knowledge/06(预算分层/标准速查/社区入口) |
| 写报告引用文献 | 先读对应域"纠错与存疑"小节 + verification/VERIFICATION.md |
| 复跑实验验证结论 | `cd reproductions && node jtag_tap.js && node stm32_bootloader.js && node can_uds_sim.js` |

## 使用纪律(保证"真实性"承诺)

1. 引用任何外部资源前,先查该条目的置信度标注与所在域 README 的"纠错"小节——本库核实过大量常见误引(如 Koscher 2010 是 IEEE S&P 不是 USENIX)。
2. 凡标注 **[未验证(已隔离)]** 或 **[中]** 的条目(如 Nest Wifi Pro 提权链、闲鱼解密现象、CANdid 题录、Rogers 2022 bus-off)不得作为事实引用,引用前必须按条目内提示检索复核。
3. 复现实验的结论以 `node <脚本>` 重跑输出为准,不依赖文档转述;实验为协议级仿真,边界声明见 reproductions/README.md。
4. 涉及真实车辆/他人设备的操作遵守 knowledge/06"纪律与法律边界"。
