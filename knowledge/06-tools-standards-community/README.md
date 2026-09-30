# 06 · 工具全景 / 标准与合规 / 社区与学习路径

> 由调研 agent 于 2026-09-30 联网搜集;工具 star 数为当日 GitHub API/页面快照,预算分层为常见零售价区间(以官方店/代理为准)。本域是全项目的横向索引:05 个领域共用的基础设施、标准、社区与入门路线都在这里。

## 方法地图

```
研究基础设施
├── 1. 硬件装备(按预算分层)
│   ├── 入门层(~$50-150): USB-UART / 逻辑分析仪 / ST-Link 克隆 / SOIC8 夹具 / RP2040
│   ├── 进阶层(~$200-800): Tigard / Bus Pirate 5 / JTAGulator / Glasgow /
│   │   ChipWhisperer-Lite / CANtact / PicoGlitcher / 入门示波器
│   └── 专业层($2k+): ChipWhisperer-Husky / GHz 示波器 / 热风拆焊台 /
│       显微镜 / EMFI 探针 / (X-ray/激光 FI 外包给实验室)
├── 2. 标准与合规
│   ├── 总线/诊断: ISO 11898 / 15765 / 14229 / SAE J1939
│   ├── 汽车网络安全: ISO/SAE 21434(取代 SAE J3061)+ UNECE R155/R156
│   ├── 功能安全对照: ISO 26262(安全≠安全 security, 引用别混)
│   └── IoT: ETSI EN 303 645 / CRA(欧盟)
├── 3. 社区与会议
│   ├── 学术: USENIX Security / CCS / IEEE S&P / USENIX WOOT / TCHES
│   ├── 行业: hardwear.io / ESCAR / Black Hat / DEF CON
│   └── Village: DEF CON Car Hacking Village / IoT Village
├── 4. 年度压力测试: Pwn2Own Automotive(2024-)
└── 5. 人物索引(本库引用过的核心研究者)
```

## 一、工具全景表(全项目汇总)

(star 为 2026-09-30 快照;"镜像"= 取自搜索镜像的 GitHub 元数据,可能滞后;其余为 GitHub API 直查)

| 工具 | 领域 | 用途 | 主页 | star 快照 |
|------|------|------|------|-----------|
| OpenOCD | 01 | 片上调试服务器(halt/dump 中枢) | github.com/openocd-org/openocd | 2338 |
| stlink | 01 | ST-Link 主机工具 | github.com/stlink-org/stlink | 5180 |
| flashrom | 01/02 | SPI/并口 flash 读写 | github.com/flashrom/flashrom | 1174 |
| Glasgow | 01 | FPGA 多协议瑞士军刀 | github.com/GlasgowEmbedded/glasgow | 2219 |
| JTAGulator | 01 | JTAG/UART 引脚自动枚举 | github.com/grandideastudio/jtagulator | 808 |
| JTAGenum | 01 | Arduino/RPi 版引脚枚举 | github.com/cyphunk/JTAGenum | 777(镜像) |
| Tigard | 01 | FT2232H 多协议工具 | github.com/tigard-tools/tigard | 869(镜像) |
| Shikra | 01 | FT232H 多协议工具 | github.com/shikras/shikra | 816 |
| Bus Pirate 5 | 01 | 多协议多工具(RP2040) | github.com/DangerousPrototypes/BusPirate5-firmware | 265 |
| HydraBus | 01 | 多协议+ NFC 扩展 | github.com/hydrabus/hydrafw | 451 |
| GreatFET | 01 | FT2232H+Facedancer 生态 | github.com/greatscottgadgets/greatfet | 354 |
| ESP32-Bit-Pirate | 01 | ESP32 Web 多协议工具 | github.com/geo-tp/ESP32-Bit-Pirate | 5930 |
| stm32f1-picopwner | 01/03 | RDP1 毛刺绕过(Pico) | github.com/CTXz/stm32f1-picopwner | 330 |
| PicoGlitcher | 01/03 | RP2040 毛刺器 | github.com/MKesenheimer/PicoGlitcher | 44(镜像) |
| binwalk | 02 | 固件签名扫描/提取 | github.com/ReFirmLabs/binwalk | 以仓库为准 |
| unblob | 02 | 现代化提取器 | github.com/onekey-sec/unblob | 以仓库为准 |
| EMBA | 02 | 固件全流程分析 | github.com/e-m-b-a/emba | 以仓库为准 |
| FACT_core | 02 | 插件化固件分析 | github.com/fkie-cad/FACT_core | 以仓库为准 |
| esptool | 02 | ESP 固件读写 | github.com/espressif/esptool | 以仓库为准 |
| mtkclient | 02 | MTK BROM 攻击 | github.com/bkerler/mtkclient | 以仓库为准 |
| firmadyne | 02 | 固件全系统仿真 | github.com/firmadyne/firmadyne | 以仓库为准 |
| can-utils | 04 | CAN 原始收发 | github.com/linux-can/can-utils | 以仓库为准 |
| python-can | 04 | CAN Python 抽象层 | github.com/hardbyte/python-can | 以仓库为准 |
| SavvyCAN | 04 | CAN 图形分析 | github.com/collin82/SavvyCAN | 以仓库为准 |
| ICSim | 04 | 仪表盘注入靶场 | github.com/zombieCraig/ICSim | 以仓库为准 |
| Caring Caribou | 04/05 | 汽车攻击框架 | github.com/CaringCaribou/caringcaribou | 以仓库为准 |
| python-udsoncan | 05 | UDS 客户端 | github.com/pylessard/python-udsoncan | 以仓库为准 |
| Ghidra | 02 | 逆向(NSA) | github.com/NationalSecurityAgency/ghidra | 以仓库为准 |

## 二、装备预算分层(给"从零到能打"的路线)

| 层级 | 预算 | 清单 | 能做什么 |
|------|------|------|----------|
| 入门层 | ~$50-150(¥400-1000) | USB-UART(CP2102/FT232RL)、8 通道逻辑分析仪克隆、ST-Link V2 克隆、SOIC8 测试夹、杜邦线、万用表;RP2040 开发板(¥20) | UART 找 shell、SPI flash in-circuit 读(flashrom)、SWD 基础烧录、JTAGenum 引脚枚举;逻辑分析仪抓 UART/SPI/I2C 时序 |
| 进阶层 | ~$200-800 | Tigard($60-80)或 Bus Pirate 5、CANtact(~$60)+ OBD 线、JTAGulator($100 套件/$200 成品)、ChipWhisperer-Lite(~$250-330)、PicoGlitcher(~€60-120)、入门示波器(Rigol/Hantek ~$300-400)、热风枪(~$60-120) | 多协议侦察全套、JTAG 自动枚举、CAN 总线研究(自有车/台架)、功耗侧信道入门与电压毛刺入门(CW-Lite + SCA101 教程)、拆焊直读 flash |
| 专业层 | $2k+ | ChipWhisperer-Husky、1GHz+ 示波器、正规拆焊台+显微镜、EMFI 探针(或外包)、ChipWhisperer 配套靶板全家桶 | 系统化侧信道/故障注入研究、RDP2 级目标、专业固件逆向工位 |

购买渠道:Glasgow/Tigard/GreatFET 走 Crowd Supply/官方代理;ChipWhisperer 走 newae.com;PicoGlitcher 走 faultyhardware.de;JTAGulator 走 EXPLIoT(2025-07 起官方制造)。

## 三、标准与合规速查

| 标准/法规 | 领域 | 一句话定位 | 状态 |
|-----------|------|------------|------|
| ISO 11898-1/-2 | CAN | CAN 数据链路/物理层定义 | 现行 |
| ISO 15765-2 (ISO-TP) | 诊断传输 | CAN 上的分段传输,UDS 的底座 | 现行 |
| ISO 14229-1 (UDS) | 诊断 | 统一诊断服务(0x10/0x27/0x22…) | 2020 版现行为主 |
| SAE J1939 | 重载车辆 | 商用车 CAN 应用层(PGN/SPN) | 持续修订 |
| ISO 26262 | 功能安全 | **safety**(随机/系统性失效),不是 security——引用勿混 | 现行 |
| SAE J3061 | 汽车网络安全 | 早期指南,已被 ISO/SAE 21434 **取代** | 已被取代 |
| ISO/SAE 21434:2021 | 汽车网络安全工程 | 全生命周期流程+TARA 方法,R155 的技术支撑 | 现行 |
| UNECE R155/R156 | 型式认证 | CSMS/软件升级管理体系,54 国新车强制(欧日等) | 强制实施中 |
| AUTOSAR SecOC | 车内通信 | 关键报文 MAC+新鲜度防重放 | 量产部署中 |
| ETSI EN 303 645 / 欧盟 CRA | IoT | 消费 IoT 安全基线/产品安全法规 | 现行/分阶段生效 |

## 四、社区与会议(入口速查)

| 社区/会议 | 定位 | 入口 |
|-----------|------|------|
| USENIX Security + WOOT | 学术主线(本库多篇来源) | usenix.org(woot 议程见 usenix.org/conference/woot24 等) |
| IEEE S&P / ACM CCS | 学术顶会(汽车安全开山论文出处) | ieee-security.org / acm.org |
| TCHES | 密码硬件侧信道专刊(Tesla 钥匙论文出处) | tches.iacr.org |
| hardwear.io | 硬件安全专业会议(TraceRip/Journey Into JTAG 等) | hardwear.io |
| DEF CON Car Hacking Village | 汽车安全动手社区(全年活动+年会) | carhackingvillage.com |
| DEF CON IoT Village | IoT 动手社区 | iotvillage.org |
| ESCAR(欧洲/美国) | 汽车安全行业会议(OEM/Tier1 主导) | 会议持续举办;检索 "ESCAR automotive security" 获取当年入口 |
| Black Hat | 综合安全会议(M&V 系列、Starlink 等出处) | blackhat.com |
| Pwn2Own Automotive(ZDI) | 汽车攻击年度压力测试 | zerodayinitiative.com/blog |
| ZDI 博客 | 漏洞研究风向标 | zerodayinitiative.com |

**人物索引**(本库引用过其工作的研究者,便于顺藤摸瓜):Travis Goodspeed(MCU 利用)、Joe Grand(JTAGulator/硬件破解)、Colin O'Flynn(ChipWhisperer)、Jasper van Woudenberg(HHH)、LimitedResults(平台毛刺)、Lennert Wouters(Tesla/Starlink)、Ken Tindell(CAN)、Craig Smith(Car Hacker's Handbook)、Sam Curry(汽车 API)、Roel Verdult(车钥匙)、Kyong-Tyck Cho & Kang G. Shin(bus-off)、Miller & Valasek(汽车远程攻击)、Dennis Giese(智能家居数据残留)、Ryan Grachek(JTAG 实战)。

## 五、十步学习路径(嵌入式+汽车硬件攻击)

1. **电气与数字基础**:万用表/逻辑分析仪使用,UART 空闲高电平、SPI 四线、I2C 寻址——Riverloop 的 HW101 系列 + VoidStar 教程(01 域 #18/#20)。
2. **第一块板**:TP-Link 旧路由器,找 UART → root shell;SPI flash 脱焊/夹具读 → binwalk 解包(01/02 域入门路径)。
3. **协议复现(零硬件)**:跑本项目三个复现实验(jtag_tap / stm32_bootloader / can_uds_sim),把 JTAG/自举协议/UDS 的状态机在协议级过一遍。
4. **调试器实操**:STM32 Nucleo + OpenOCD/ST-Link,halt/dump/restore;理解 RDP 分级(01 域)。
5. **固件分析流水线**:binwalk/sasquatch/firmwalker → Ghidra;EMBA 跑一次完整分析。
6. **毛刺入门**:ChipWhisperer-Lite + SCA101 教程(侧信道与本域交界,配合 side-channel-research 项目);然后 stm32f1-picopwner 复现 RDP1 绕过。
7. **CAN 入门**:ICSim 信号逆向 → python-can/candump → 自有车辆 OBD 被动监听(只听不发!注意当地法规)。
8. **UDS 实操**:python-udsoncan 对模拟器/台架走 0x10/0x27;对照 ISO 14229 服务表读 NRC 语义。
9. **经典文献精读**:按各域"入门路径"的顺序读(Koscher'10→Checkoway'11→M&V;WOOT'17/'20;Tesla 双论文;Tindell 2023)。
10. **场景实战与社区**:参加 DEF CON CHV 的 CTF(如每年 car hacking CTF)、复现 hextree/Goodspeed 书中案例;持续跟踪 hardwear.io、ZDI、ESCAR 的议题动向。

## 六、纪律与法律边界(不可跳过)

1. **授权边界**:对车辆/设备的攻击实验只在**自有财产或书面授权**(CTF/实验室/渗透合同)范围内进行;公共道路上的任何主动注入实验在绝大多数司法辖区违法(即使"只是测试")。
2. **无钥匙攻击**:中继/RollJam 类研究只对**自己的车/自己的车库**做;对他人车辆实施即构成盗窃工具行为。
3. **固件与数据**:二手设备取证注意隐私法规(用户数据残留研究应以脱敏/自购设备为限);下载/分析受版权保护的固件注意当地合理使用边界。
4. **发表伦理**:发现真实车辆/设备漏洞走负责任披露(厂商 PSIRT/CERT;汽车行业有 ISO/SAE 21434 定义的漏洞处置流程),参考 Wouters 对 Tesla 的披露路径。
5. **本库用途声明**:知识库用于防御研究、授权测试与学习;未验证条目(各域"存疑"小节)不得作为事实引用,更不得作为攻击依据。

## 纠错与存疑

1. **star 数时效**:表中数字为 2026-09-30 快照,GitHub star 自然增长,引用精确数字前复核;"镜像"标注条目可能滞后数周。
2. **价格时效**:装备价格为常见零售区间,以官方店为准;ChipWhisperer-Lite/Husky 价格随配置浮动。
3. **ESCAR 官网**:会议存在与定位确凿,官网 URL 未核实(历年域名有变动),以检索结果为准。
4. **ETSI EN 303 645/CRA 生效节奏**:方向性描述可信,分阶段时间表未逐条核对,引用以欧盟官方公报为准。
