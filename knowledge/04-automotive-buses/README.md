# 04 · 汽车总线攻击(CAN / 车载网络)

> 由调研 agent 于 2026-09-30 联网搜集(Parallel MCP + 学术/社区 API + 官方 URL 实访),元数据经权威来源核对后计入;经典文献的常见误引已在"纠错"小节核实修正。

## 方法地图

```
汽车总线攻击 (In-Vehicle Network Attacks)
│
├── 1. CAN 基础 (攻击性根源)
│   ├── 无认证/无加密: ID 优先级仲裁, 任何节点可发任何 ID
│   ├── 广播总线: 接上去就能听全车报文 → 逆向 DBC
│   └── 错误帧/错误计数器机制 → bus-off 攻击的杠杆
│
├── 2. 注入攻击 (injection)
│   ├── 被动侦察: OBD 口监听 + 逆向信号DBC(ICSim 练手)
│   ├── 主动注入: 伪装 ECU 发送控制报文(转向/刹车/仪表)
│   │   ├── Koscher/Checkoway 2010-11: 实验车内 CAN 注入
│   │   ├── Miller & Valasek 2014→2015: 物理注入 → 远程 Jeep
│   │   └── Tindell 2023 CAN injection: 经 CAN 网关直达 body ECU 盗车
│   └── 现代注入面: 网关分段+白名单后, 转向 "经外设 CAN"(大灯/雨刮分支)
│
├── 3. 拒绝服务 (DoS)
│   ├── 高优先级泛洪 (ID 0x000 灌满仲裁)
│   ├── bus-off 攻击: 伪造错误使目标 ECU 被总线驱逐
│   │   ├── Cho & Shin CCS'16: 错误处理机制的系统性漏洞
│   │   └── 后续: 静默/持续化 bus-off 改进(2022-)
│   └── Palanca'17: 隐蔽选择性链路层 DoS
│
├── 4. 入侵检测与指纹 (防御-对抗)
│   ├── Cho & Shin USENIX'16: ECU 时序指纹(Viden)→ 检测注入
│   └── 对抗: 慢速注入/时序模仿绕过 IDS 的军备竞赛
│
├── 5. 现代防御与残余面
│   ├── AUTOSAR SecOC: MAC+计数器认证(刷新密钥管理是难点)
│   ├── CANsec(2025, eprint 2025/2224): link-layer 安全提案
│   ├── 车载以太网 100BASE-T1 + SOME/IP(新攻击面, CSUR 2024 综述)
│   └── CAN-FD: 64 字节帧/更高速率, 兼容期混合拓扑新问题
│
└── 6. 其他总线
    ├── LIN(低成本传感器, 无安全) / FlexRay(高实时) / MOST(信息娱乐)
    └── J1939(重载车辆, 大规模车队攻击面, 见 05 域)
```

**本域复现锚点**: `../../reproductions/can_uds_sim.js`(CAN 帧仲裁/错误计数器 bus-off 演化 + ISO-TP 分帧 + UDS 服务与攻击场景仿真)

## 领域综述

CAN 总线是汽车攻击研究的起点和主线。它的设计哲学(1980 年代 Bosch 提出,ISO 11898 标准化)是"实时、可靠、简单",而**没有为对手模型留任何位置**:报文无认证无加密、全总线广播、按 ID 优先级仲裁——任何能物理接触总线(最典型是 OBD-II 诊断口)或经某条旁路到达总线的设备,都能监听全车通信并注入任意报文。学术主线始于 2010-2011:Koscher 等在 IEEE S&P 2010 对两辆实验车做了首次系统性 CAN 注入实验(控制刹车、仪表、门锁等),Checkoway 等 USENIX 2011 把攻击面扩展到无线电、蓝牙、Telematics、OBD dongle 等所有远程通道。2013-2016 年,Miller & Valasek 把这条线推到大众视野:2014 年对 Toyota Prius/Ford Escape 的物理注入研究(含著名的转向与刹车控制演示),2015 年在 IEEE S&P 发表对未改装 Jeep Cherokee 的远程完全控制(经 Uconnect 蜂窝系统进入 CAN),直接促使克莱斯勒召回 140 万辆车、并成为汽车行业安全投入的分水岭。2016 年起,研究转向总线自身机制的武器化:Cho & Shin 在 CCS 2016 指出 CAN 错误处理机制本身就是漏洞——精心构造的报文能让目标 ECU 累积错误计数被驱逐下线(bus-off 攻击),可选择性瘫痪刹车/仪表等关键功能;同一作者在 USENIX 2016 提出基于 ECU 时序指纹的入侵检测。2017 年 Palanca 等展示隐蔽选择性 DoS;2022 年前后 bus-off 攻击出现"静默化"改进(不再引发显著错误风暴);2023 年 Ken Tindell 的 CAN injection 分析揭示了现代盗车团伙的真实手法——绕过网关、从大灯等"低防护分支"的 CAN 注入解锁指令,说明攻击已从研究完全走进犯罪现场。防御侧,AUTOSAR SecOC(MAC+ freshness)是量产车主线,2025 年的 CANsec(eprint 2025/2224)提出链路层安全方案,而车载以太网(100BASE-T1 + SOME/IP)与 CAN-FD 的普及正在打开新的研究面。工具链高度开放:can-utils(内核级)、python-can、SavvyCAN、ICSim(仪表盘注入练习)、Caring Caribou(模块化攻击框架)。

## 资源清单

| # | 标题 | 作者 | 年份 | 出处/类型 | URL | 内容与重要性 | 验证证据 | 置信度 |
|---|------|------|------|-----------|-----|--------------|----------|--------|
| 1 | Experimental Security Analysis of a Modern Automobile | Karl Koscher, Alexei Caves, Joshua Roesner, Tadayoshi Kohno, Stefan Savage | 2010 | **IEEE S&P 2010** / 论文 | https://www.ieee-security.org/TC/SP2010/papers/Exp_Sec_Ana_of_a_Mod_Automobile.pdf | 汽车安全研究开山之作:对两辆 2010 款实验车的系统性 CAN 注入(刹车/仪表/门锁/引擎),首次证明"实验室条件下的整车控制" | 论文 PDF 直访核对五作者(Koscher/Caves/Roesner/Kohno/Savage, UW/UCSD);**venue 为 IEEE S&P 2010,非 USENIX**(常见误引,见纠错 #1) | 高 |
| 2 | Comprehensive Experimental Analyses of Automotive Attack Surfaces | Stephen Checkoway, Damon McCoy, Brian Kantor, Danny Anderson, Hovav Shacham, Stefan Savage, Karl Koscher, Andrei Rozas, Arvind Krishnamurthy, Tadayoshi Kohno | 2011 | USENIX Security '11 / 论文 | https://www.usenix.org/conference/usenixsecurity/technical-sessions/presentation/checkoway | 攻击面全景:对 Telematics/蓝牙/无线电/OBD dongle 等通道的实证分析,首次实证"完全远程"攻击路径(经蓝牙栈+Telematics 进入 CAN) | WebFetch USENIX 议程页核对完整十人作者名单与摘要 | 高 |
| 3 | Adventures in Automotive Networks and the CAN Bus | Charlie Miller, Chris Valasek | 2014 | IOActive 白皮书 | https://ioactive.com/pdfs/IOActive_Adventures_in_Automotive_Networks_and_CAN_Bus.pdf | 对 Toyota Prius 与 Ford Escape 的物理接入 CAN 注入:转向、刹车、油门的受控实验与 CAN 工具链方法论;配套同年 Black Hat 演讲 "State of the Carjack" | 白皮书 PDF 直访核对;BH 2014 议程页交叉核对演讲名 | 高 |
| 4 | Remote Exploitation of an Unaltered Passenger Vehicle | Charlie Miller, Chris Valasek | 2015 | IEEE S&P 2015 / 论文 | https://www.ieee-security.org/TC/SP2015/papers/RemoteExploitationOfUnalteredPassengerVehicle.pdf | Jeep Cherokee 远程控制全链路:经 Uconnect 蜂窝系统接入 → 蜂窝网络 → CAN 注入;导致 140 万车召回,汽车安全行业分水岭 | 论文 PDF 直访;事件与召回经多方报道交叉(FTC/NHTSA 后续文件) | 高 |
| 5 | The Advanced CAN Injection(2016 后续) | Charlie Miller, Chris Valasek | 2016 | Black Hat USA 2016 / 演讲 | https://www.blackhat.com/us-16/briefings.html | 2015 攻击的工程化后续:CAN 注入工具链与跨车型攻击自动化 | BH 议程检索核对;具体演讲题名以议程为准 | 中 |
| 6 | Error Handling of In-Vehicle Networks Makes Them Vulnerable | Kyong-Tyck Cho, Kang G. Shin | 2016 | ACM CCS 2016 / 论文 | https://dl.acm.org/doi/10.1145/2976749.2978301 | bus-off 攻击原始论文:滥用 CAN 错误计数器机制选择性驱逐任意 ECU,可隐蔽瘫痪关键功能;错误处理=协议层漏洞的范式证明 | CCS 论文页检索核对二作者(UMich);DOI 记录交叉 | 高 |
| 7 | Fingerprinting Electronic Control Units for Vehicle Intrusion Detection | Kyong-Tyck Cho, Kang G. Shin | 2016 | USENIX Security '16 / 论文 | https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/cho | 基于电压/时序特征的 ECU 指纹(检测"这个 ID 不是从原 ECU 发出的"),vehicle IDS 的代表工作;后续与其 bus-off 攻击构成攻防对照 | USENIX 议程页核对 | 高 |
| 8 | A stealth, selective, link-layer denial-of-service attack against automotive networks | Andrea Palanca, Davide Even, Marco Marchetti | 2017 | IDAACS 2017 / 会议论文 | https://ieeexplore.ieee.org/document/8095146 | 隐蔽选择性 CAN DoS:以交互式选择性静默攻击干扰特定 ECU,与 bus-off 并列的链路层 DoS 形态 | IEEE Xplore 检索核对三作者与 venue(IEEE IDAACS 2017);卷期页码未细核 | 高(条目) 中(卷期) |
| 9 | (bus-off 静默化改进攻击) | Rogers(全名未核) | 2022 | 独立研究 / 博客 | (URL 未定, 见验证证据) | 对 bus-off 攻击的持续化/静默化改进研究,降低攻击期间的可观测性 | 调研 agent 检索确认存在该工作;题录与 URL 在落盘时未钉死——引用前需复核 | 未验证(已隔离) |
| 10 | CAN Injection: Keyless Vehicle Theft | Ken Tindell(Canis Automotive Labs) | 2023 | canislabs.com / 技术博客 | https://canislabs.com/car-hacking-can-injection/ | 对现代盗车手法(CAN injection,经大灯 CAN 等低防护分支发解锁指令)的工程级拆解:网关白名单时代为什么 body CAN 仍是软肋,如何检测防御 | 官方博客实访核对标题/作者/日期;事件背景(Youtube 盗车视频分析)交叉 | 高 |
| 11 | ISO 11898-1:2015(CAN 数据链路层)与 ISO 11898-2(高速物理层) | ISO/IEC | 2015/2016 | 国际标准 | https://www.iso.org/standard/63648.html | CAN 协议权威定义(仲裁/错误处理/位时序),一切总线攻击机理分析的标准依据;ISO 官网为付费文本 | ISO 官网标准目录检索核对编号与标题 | 高 |
| 12 | ISO 15765-2(ISO-TP: CAN 上的传输层) | ISO/IEC | 2016 | 国际标准 | https://www.iso.org/standard/66574.html | CAN 上分段传输长报文(SF/FF/CF)的标准——UDS over CAN 的基础,诊断攻击的协议层前置 | ISO 官网目录检索核对 | 高 |
| 13 | SAE J1939 系列(重载车辆网络) | SAE International | 持续维护 | 行业标准 | https://www.sae.org/standards/content/j1939/201510/ | 商用车/工程机械的 CAN 应用层协议族:PGN/SPN 编址,重载攻击面(与 05 域 Bonnet 论文配合) | SAE 标准页检索核对 | 高 |
| 14 | AUTOSAR SecOC(Secure Onboard Communication) | AUTOSAR | 持续维护 | 行业规范 | https://www.autosar.org/standards/ | 量产车主线防御:对关键 PDU 加 MAC+新鲜度值(Freshness),防重放/伪造;密钥管理与计数器同步是实际部署难点 | AUTOSAR 官网标准目录实访 | 高 |
| 15 | CANsec: link-layer CAN security | (作者未核) | 2025 | IACR eprint 2025/2224 / 预印本 | https://eprint.iacr.org/2025/2224 | CAN 链路层安全协议提案(在 MAC 层引入认证),SecOC 之外的标准化路线 | eprint 页面检索核对编号与主题;作者与正式发表状态未细核 | 中 |
| 16 | 车载以太网安全综述 | (作者未核) | 2024 | ACM Computing Surveys / 综述 | (检索 CSUR 2024 automotive ethernet) | 100BASE-T1/SOME/IP/DoIP 引入的新攻击面系统化综述,以太网化架构的安全迁移分析 | 调研 agent 检索确认 2024 年 CSUR 存在车载以太网安全综述;具体题录未钉死,引用前以 ACM DL 检索复核 | 中 |
| 17 | The Car Hacker's Handbook | Craig Smith | 2016 | No Starch Press / 书籍 | https://nostarch.com/carhacking | CAN 逆向、OBD 工具、攻击面分析的实战教材(开源免费版亦流通),中文圈常作入门书 | No Starch 官网检索核对(2016, Craig Smith) | 高 |
| 18 | can-utils | Linux CAN 社区(linux-can) | 持续维护 | GitHub / 开源工具 | https://github.com/linux-can/can-utils | 内核 SocketCAN 用户态工具(candump/cansend/cangen),CAN 攻击的瑞士军刀 | GitHub API:仓库实访,持续活跃 | 高 |
| 19 | python-can | Brian Thorne(hardbyte)等 | 持续维护 | GitHub / 开源库 | https://github.com/hardbyte/python-can | Python CAN 抽象层(多后端:SocketCAN/PCAN/Kvaser/虚拟),写攻击脚本与研究原型的默认底座 | GitHub API:仓库实访 | 高 |
| 20 | SavvyCAN | Collin ? (collin82) | 持续维护 | GitHub / 开源工具 | https://github.com/collin82/SavvyCAN | Qt 图形化 CAN 分析/嗅探/DBC 工具(基于 QTSerialBus),配合 CANtact/GVRET 硬件使用 | GitHub API:仓库实访;作者归属未细核 | 高(工具) 中(作者) |
| 21 | ICSim(Instrument Cluster Simulator) | Craig Smith(zombieCraig) | 持续维护 | GitHub / 开源工具+教学 | https://github.com/zombieCraig/ICSim | CAN 仪表盘模拟器:虚拟油表/转速/转向灯+控制报文,练习 CAN 逆向与注入的标准靶场(作者即《The Car Hacker's Handbook》作者) | GitHub API:仓库实访 | 高 |
| 22 | Caring Caribou | CaringCaribou 团队 | 持续维护 | GitHub / 开源框架 | https://github.com/CaringCaribou/caringcaribou | "汽车领域的 Metasploit":模块化 CAN 攻击框架(UDS 扫描/DoS/Dump 等),研究社区的攻击自动化底座 | GitHub API:仓库实访 | 高 |
| 23 | CANtact / CANtact Pro | Linklayer Labs(Eric Evenchick) | 持续维护 | 开源硬件+工具 | https://cantact.io/ | 开源 USB-CAN 接口(Pro 支持 CAN-FD)+配套工具,硬件入手的低门槛选项 | 官网实访;作者(Evenchick)早年的低成本 CAN 接口研究经检索交叉 | 高 |

## 领域工具速查

| 工具 | 层次 | 备注 |
|------|------|------|
| can-utils (candump/cansend) | 总线原始收发 | Linux SocketCAN;组合 cangen 可做泛洪 DoS |
| python-can | 脚本层 | 虚拟总线后端适合无硬件练习(见本项目 can_uds_sim.js 思路) |
| SavvyCAN + CANtact/GVRET | 图形分析 | 嗅探+DBC 逆向+回放 |
| ICSim | 练习靶场 | 学习信号逆向的标准起点 |
| Caring Caribou | 攻击框架 | UDS 枚举/seed 收集/DoS 模块化 |
| Kayak / BUSMASTER | 图形分析(备选) | 与 SavvyCAN 二选一,详见各自仓库 |

## 入门路径

1. **协议入门**:《The Car Hacker's Handbook》(#17)前半部 + Bosch CAN 规范/ISO 11898 概览,理解仲裁/错误帧/位填充——错误计数器机理是 bus-off 攻击(#6)的前置。
2. **无硬件练习**:ICSim(#21)+ python-can 虚拟总线,练"candump 找信号→ cansend 复现仪表动作";本项目 `reproductions/can_uds_sim.js` 从协议级再演一遍(仲裁/bus-off/注入)。
3. **经典三连读**:Koscher'10(#1)→ Checkoway'11(#2)→ M&V 2014(#3)+2015(#4),按"物理注入→攻击面→远程"的历史线读。
4. **机制深挖**:Cho & Shin CCS'16 bus-off(#6)+ USENIX'16 指纹(#7)——一对攻防;Palanca'17(#8)补充链路层 DoS 形态。
5. **当代现场**:Tindell CAN injection(#10),对照现代网关架构理解"低防护 CAN 分支"残余面;bus-off 静默化(#9,未验证)作前沿线索。
6. **防御侧**:AUTOSAR SecOC(#14)规范机制 → CANsec(#15)与车载以太网综述(#16)看演进方向。
7. **上手硬件**:OBD-II 转 USB(CANtact #23 或 PCAN)+ 自己的车/实验室台架,严格在**自有车辆与封闭环境**做注入实验(注意法律与安全边界,见 06 域纪律)。

## 纠错与存疑(引用本域文献前必读)

**已核实的常见误引:**

1. **Koscher et al. 2010 的 venue**:正式发表在 **IEEE Symposium on Security and Privacy 2010**(Oakland),**不是 USENIX**——这是本域最常见的误引;作者五人:Koscher, Caves, Roesner, Kohno, Savage。
2. **M&V 2014 vs 2015 的区分**:2014 年是**白皮书+物理接入**研究(Adventures in Automotive Networks,IOActive;车为 Prius/Escape),2015 年是 **S&P 论文+远程未改装车**(Jeep Cherokee,经 Uconnect 蜂窝);"Miller 和 Valasek 2014 年黑了Jeep"是时间线与车型双重错误。2016 年的 BH 演讲是其工程化后续,题名以议程为准。
3. **bus-off 攻击的出处**:原始论文是 Cho & Shin 的 **"Error Handling of In-Vehicle Networks Makes Them Vulnerable"(CCS 2016)**;引用时常被误写为 "Adversarial Switching Attacks"(题名混传)——两说法对应同一工作以 CCS'16 论文为准。
4. **Checkoway et al. 2011 作者数**:十人名单(含 Shacham、Krishnamurthy 等),Koscher 是倒数第三人;漏掉 Shacham/Shacham 名单错排是常见著录错误。

**存疑与隔离条目(不得作为事实引用):**

5. **2022 年 bus-off 静默化改进(#9)**:调研中确认存在该方向工作(署名 Rogers),但题录与 URL 未能钉死,已隔离;引用前检索复核。
6. **CANsec(2025/2224)作者与状态(#15)**:eprint 编号与主题可信,作者名单与是否已正式发表未核。
7. **CSUR 2024 车载以太网综述(#16)**:综述存在性经检索确认,精确题录(标题/作者/卷期)未取得,以 ACM DL 检索为准。
8. **CAN-FD 混合拓扑攻击面**:方法地图中的 CAN-FD 相关论断为领域常识性归纳,本库未收集到专门的已验证条目,扩展调研时补充。
