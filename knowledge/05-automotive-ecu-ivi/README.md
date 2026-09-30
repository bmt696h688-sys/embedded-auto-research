# 05 · 汽车安全:UDS 诊断 / ECU·车机提取 / 无钥匙系统

> 由调研 agent 于 2026-09-30 联网搜集(Parallel MCP + 学术/标准/社区 API + 官方 URL 实访);Pwn2Own 历届数字、KeeLoq/Hitag2 攻击谱系、Tesla 钥匙论文等关键元数据均经实访或双源核对。

## 方法地图

```
汽车 ECU/车机/钥匙攻击
│
├── 1. UDS 诊断协议攻击 (ISO 14229 / ISO 15765)
│   ├── 0x10 会话切换: 会话状态机缺陷(降级/跨会话保持)
│   ├── 0x27 SecurityAccess: seed-key 弱点
│   │   ├── 弱 PRNG(种子可预测/周期短/复位即重放)
│   │   ├── 算法可逆(硬编码/弱混淆, 固件逆向即得)
│   │   └── 种子跨 ECU 复用/不刷新
│   ├── 0x22/0x2E 读写 DID: 敏感数据无访问控制(标定/密钥/配置)
│   ├── 0x31 例程控制 & 0x34-0x37 下载数据: 刷写=任意代码植入面
│   ├── 0x29 认证(2020 版新增): 部署率低
│   └── 功能寻址(Functional 0x7DF)广播扫描: 一次叫醒全网关
│
├── 2. ECU/车机固件与数据
│   ├── OBD 0x34 下载面 + 刷写工具(官方/第三方)逆向
│   ├── 车机(IVI): Android Automotive/QNX 生态 → APK 提取/调试口
│   ├── Telematics box(4G/5G): 远程注入的跳板(Checkoway'11→Pwn2Own)
│   └── 网关(GW): 域隔离与白名单的绕过(Tindell 2023 的"软肋分支")
│
├── 3. 无钥匙进入与启动 (keyless)
│   ├── RKE 滚码: KeeLoq(滑动/代数/功耗攻击谱系, 2007-08 全面沦陷)
│   ├── 应答器: Hitag2(2012-2017 三连破)/Megamos
│   ├── PKES 被动无钥匙: 中继攻击(距离不设防)
│   ├── Tesla: DST80(TCHES'19)→ Model 3 PKES(TCHES'21)
│   └── 信号层: RollJam(记录-阻塞-重放)
│
└── 4. 合规与评估框架
    ├── ISO/SAE 21434:2021(工程流程) + UNECE R155/R156(型式认证)
    └── Pwn2Own Automotive: 全行业攻击面的年度压力测试
```

**本域复现锚点**: `../../reproductions/can_uds_sim.js`(UDS 0x10/0x27/0x22 服务仿真+弱种子 PRNG 攻击+会话降级场景)

## 领域综述

现代汽车是"几十台联网计算机+一个物理壳",而 UDS(ISO 14229)诊断协议是贯穿所有 ECU 的万能后门:它设计给维修工坊用,权限模型却极其粗糙。0x27 SecurityAccess 的 seed-key 认证是最著名的软肋——ECU 发一个种子,请求方以"保密算法"回算密钥,但算法就藏在固件里,固件逆向(02 域方法)即可提取;更糟的是种子常由弱 PRNG 生成或复位后重复,2024 年的 CANdid 等工作针对这一环节系统化研究。0x22/0x2E 读写 DID、0x34-0x37 刷写下载则把"诊断口=固件读写口"写进了协议本身;2020 版新增的 0x29 认证服务在存量车里部署率很低。攻击者到诊断口的路径也在演进:Checkoway'11 已证明 Telematics/蓝牙可远程到达 CAN;此后 OBD dongle(插在车上的联网小盒子)成为新跳板,ESORICS'18 的《Beneath the Bonnet》对重载车辆(J1939+遥测狗)做了系统分析;Sam Curry 团队 2023 年对主流车企的 API/账号体系大规模研究(Web Hackers vs The Auto Industry)则展示了"云端即攻击面"的当代形态。最锋利的检验场是 Pwn2Own Automotive:ZDI 主办、2024 年起在东京办赛,针对 Tesla、车机、充电桩等目标,历届战果(2024:49 个 0day/1,323,750 美元;2025:49 个/886,250;2026:76 个/1,047,000)是行业攻击面的年度体检报告。物理钥匙侧是一部"密码学进化史":KeeLoq 滚码在 2007-2008 年被滑动攻击、代数攻击与功耗分析接力攻破;Hitag2 应答器自 2012 年起被连续拆解;Tesla 的 DST80 钥匙(Wouters, TCHES 2019)与 Model 3 的 PKES(TCHES 2021)表明新机制仍会在实现细节上翻车;中继攻击则至今没有便宜的根治方案。合规侧,ISO/SAE 21434:2021 定义工程流程安全,UNECE R155 把 CSMS(网络安全管理体系)变成欧美新车上市准入条件——从"可黑"到"必须不可黑"的监管闭环正在形成,但存量车与售后生态仍是旷野。

## 资源清单

| # | 标题 | 作者 | 年份 | 出处/类型 | URL | 内容与重要性 | 验证证据 | 置信度 |
|---|------|------|------|-----------|-----|--------------|----------|--------|
| 1 | ISO 14229-1:2020 Unified Diagnostic Services (UDS) | ISO | 2020 | 国际标准 | https://www.iso.org/standard/72439.html | UDS 权威文本:0x10/0x27/0x22/0x2E/0x31/0x34-37/0x29 全部服务的状态机与否定响应码——诊断攻击分析的第一手规范依据(付费文本) | ISO 官网标准目录检索核对编号/年份/标题 | 高 |
| 2 | ISO 15765-2(ISO-TP)/ ISO 11898 见 04 域 | ISO | 2016 | 国际标准 | 见 04 域 #12 | UDS over CAN 的传输层与链路层前置 | 同 04 域 | 高 |
| 3 | Beneath the Bonnet(重载车辆遥测攻击) | (作者未核) | 2018 | ESORICS 2018 / 论文 | (检索 ACM DL "Beneath the Bonnet" ESORICS 2018) | 经售后遥测 dongle 攻击 J1939 重载车辆:诊断口+蜂窝跳板的系统分析,"车联网盒子=攻击面"的代表研究 | 调研确认论文存在(ESORICS 2018);完整题录/作者在落盘时未钉死,引用前以 ACM DL/Springer 复核 | 中 |
| 4 | CANdid(UDS SecurityAccess 弱种子研究) | (作者未核) | 2024 | USENIX Security '24 / 论文 | (检索 USENIX '24 "CANdid") | 针对真实车辆 UDS seed 生成的系统研究:弱随机性/重放等缺陷的检测框架——0x27 攻击的当代代表 | 调研确认 USENIX '24 存在该工作;题录未钉死,引用前复核 | 中 |
| 5 | Web Hackers vs. The Auto Industry | Sam Curry 等 | 2023 | 独立研究 / 博客 | https://samcurry.net/web-hackers-vs-the-auto-industry/ | 对多家主流车企 Web/API/账号体系的大规模安全研究(远程开锁/启动、账户接管、密钥泄露),当代"云端攻击面"代表作 | 博客原文实访;多个 CVE 与厂商公告交叉验证 | 高 |
| 6 | Pwn2Own Automotive 2024 战报 | ZDI(Zero Day Initiative) | 2024 | 趋势科技 ZDI / 官方博客 | https://www.zerodayinitiative.com/blog | 东京首届汽车专场:49 个 0day、总奖金 $1,323,750;目标含 Tesla Wall Connector、车机 IVI、充电桩——行业攻击面年度压力测试 | ZDI 官方博客实访核对数字;主流媒体报道交叉 | 高 |
| 7 | Pwn2Own Automotive 2025 战报 | ZDI | 2025 | ZDI / 官方博客 | https://www.zerodayinitiative.com/blog | 第二届:49 个 0day、$886,250;车机与 EV 充电桩仍是重灾区 | ZDI 官方博客实访核对数字 | 高 |
| 8 | Pwn2Own Automotive 2026 战报 | ZDI | 2026 | ZDI / 官方博客 | https://www.zerodayinitiative.com/blog | 第三届:76 个 0day、$1,047,000;目标扩展(Tesla、IVI、充电、V2X 相关) | ZDI 官方博客实访核对数字 | 高 |
| 9 | Attacks on the KeeLoq Block Cipher and Authentication Systems | Andrey Bogdanov | 2007 | RFIDSec 2007 / 会议论文 | (检索 "Bogdanov KeeLoq RFIDSec 2007") | KeeLoq 首个公开系统性攻击(滑动攻击基础),后续 2008 年攻击潮的起点 | 经学术索引检索核对作者/年份/venue;PDF 由作者主页流通 | 高(题录) 中(URL) |
| 10 | Algebraic and Slide Attacks on KeeLoq | Nicolas Courtois, Gregory Bard, David Wagner | 2008 | FSE 2008 / 会议论文 | (检索 "Algebraic and Slide Attacks on KeeLoq") | 代数(SAT)攻击 KeeLoq:单密钥恢复在可行时间内,证明其密码强度不足 | 学术索引检索核对三作者与 FSE 2008 venue | 高(题录) 中(URL) |
| 11 | A Practical Attack on KeeLoq | Sebastian Indesteege 等 | 2008 | EUROCRYPT 2008 / 论文 | https://doi.org/10.1007/978-3-540-78967-3_24 | 侦听少量报文即可恢复密钥的实用攻击(结合滑动与旁路),直接威胁真实车库/钥匙系统 | DOI/Crossref 检索核对;作者列表以正式版为准 | 高(题录) |
| 12 | On the Power of Power Analysis in the Real World: A Complete Break of the KeeLoq Code Hopping System | Thomas Eisenbarth 等 | 2008 | CRYPTO 2008 / 论文 | https://doi.org/10.1007/978-3-540-85174-5_12 | 侧信道功耗分析完整攻破 KeeLoq 跳码系统(硬件+协议+工程全链)——与 01 域(SCA)方法直接衔接的汽车案例 | Crossref/DOI 检索核对 CRYPTO 2008 | 高(题录) |
| 13 | Gone in 360 Seconds: Hijacking with HiTag2 | Roel Verdult, Flavio D. Garcia, Emmanouil Balasch | 2012 | USENIX Security '12 / 论文 | https://www.usenix.org/conference/usenixsecurity12/technical-sessions/presentation/verdult | Hitag2 应答器实战攻破:对真实防盗系统的密码分析(侦听+计算),开启后续车钥匙攻击线 | USENIX 议程页实访核对三作者与摘要 | 高 |
| 14 | Dismantling HiTag2(后续深化) | (作者未核) | 2016 | (venue 未核) | (检索 "Dismantling Hitag2") | Hitag2 的进一步密码分析与攻击简化 | 调研确认存在后续工作;题录未钉死,引用前检索复核 | 中 |
| 15 | Hitag2 相关 WOOT 2017 工作 | (作者未核) | 2017 | USENIX WOOT '17 / 论文 | (检索 WOOT '17 Hitag2) | Hitag2 攻击在 WOOT'17 的继续(与汽车防盗系统实现相关) | 调研确认存在;题录未钉死 | 中 |
| 16 | Dismantling DST80: An Improved Attack on the Tesla Model S Key Fob | Lennert Wouters, Benedikt Gierlichs, Frank Piessens | 2019 | TCHES 2019(2) / 论文 | https://tches.iacr.org/index.php/TCHES/article/view/7399 | Tesla Model S 钥匙(DST80)的密码缺陷与快速密钥恢复;作者随后负责任披露,推动 Tesla 更换钥匙方案 | TCHES 官网检索核对;KU Leuven COSIC 发布公告交叉 | 高(题录) 中(URL) |
| 17 | Fast, Furious and Insecure: Passive Keyless Entry and Start in Modern Supercars | Lennert Wouters, Daniele Antonioli, Benedikt Gierlichs, Frank Piessens | 2021 | TCHES 2021(3) / 论文 | https://tches.iacr.org/index.php/TCHES/article/view/9064 | 对 Tesla Model 3 等现代 PKES 的中继攻击与系统分析——"钥匙在兜里,车被开走"的工程级证明 | TCHES 官网检索核对(2021 年 3 期);作者与前作同人可交叉 | 高(题录) 中(URL) |
| 18 | RollJam | Samy Kamkar | 2015 | samy.io / 概念攻击+演示 | https://samy.pl/rolljam/ | 滚码劫持:记录-阻塞-重放,用两条先后捕获的滚码骗过防重放——对 KeeLoq 类跳码系统的信号层通用攻击 | 作者官网实访;报道与技术分析多源交叉 | 高 |
| 19 | ISO/SAE 21434:2021 Road vehicles — Cybersecurity engineering | ISO/SAE | 2021 | 国际标准 | https://www.iso.org/standard/70982.html | 汽车网络安全工程流程标准(概念→开发→生产→运维全生命周期),TARA 分析方法框架;R155 的技术支撑 | ISO 官网目录检索核对 | 高 |
| 20 | UN Regulation No. 155(车辆网络安全管理体系 CSMS) | UNECE WP.29 | 2021 | 联合国法规 | https://unece.org/transport/documents/2021/03/unece-vehicle-regulations-1958-agreement-regulation-no-155 | 把 CSMS 变成 54 国(含欧盟、日本)新车型式认证强制条件——从自愿到强制的监管转折;配套 R156(软件升级管理 SUMS) | UNECE 官网文件页检索核对 | 高 |
| 21 | 腾讯科恩实验室 Tesla 远程攻击(2016-2017) | Tencent Keen Security Lab | 2016-2017 | 官方博客/会议 / 技术报告 | https://keenlab.tencent.com/ | Model S/Model X 多轮远程攻击研究(停车/行驶状态控制),国内团队进入全球视野的代表作;特斯拉多次致谢与修复 | 实验室官网检索核对系列报告;Tesla 官方致谢与媒体报道交叉 | 中(官网细节) 高(事件) |
| 22 | The Car Hacker's Handbook | Craig Smith | 2016 | No Starch / 书籍 | 见 04 域 #17 | 诊断口实操章节(ODB/UDS 工具链)与整体方法论 | 同 04 域 | 高 |
| 23 | python-udsoncan | pylessard 等 | 持续维护 | GitHub / 开源库 | https://github.com/pylessard/python-udsoncan | UDS 客户端 Python 实现(服务级 API),配 python-can 即成脚本化诊断攻击/测试底座 | GitHub API:仓库实访 | 高 |
| 24 | "SoK 2025(汽车安全)" | (作者未核) | 2025 | (venue 未核) | (需检索复核) | 调研中发现的 2025 年汽车安全系统化知识论文 | 题录未钉死——引用前必须检索复核 | 未验证(已隔离) |

## 入门路径

1. **协议层打底**:ISO 14229 服务表(0x10/0x27/0x22/0x2E)通读;跑本项目 `reproductions/can_uds_sim.js` 把会话/认证/读写状态机打一遍,理解 NRC(0x22/0x24/0x33)的语义。
2. **工具链**:python-can + python-udsoncan(#23)对自有无害目标(OBD 模拟器/旧 ECU 台架)做 0x10/0x27 流程;SavvyCAN 抓诊断流量。
3. **读三组经典**:①Checkoway'11(04 域 #2)→ Beneath the Bonnet(#3)→ Curry 2023(#5):远程到达路径的二十年;②KeeLoq 谱系(#9→#10→#11→#12)+ RollJam(#18)+ Hitag2(#13):物理钥匙沦陷史;③Tesla 双论文(#16/#17)。
4. **看压力测试**:Pwn2Own 三届战报(#6/#7/#8),按被攻破目标类型(车机/桩/Tesla)归纳当前热点攻击面。
5. **合规视角**:ISO/SAE 21434(#19)+ UNECE R155/R156(#20),理解车企侧的防御义务与流程。
6. **动手(有条件)**:旧 ECU/开发台架上练习 UDS 枚举与刷写分析;严格限制在自有设备与合法环境(见 06 域纪律)。

## 纠错与存疑(引用本域资源前必读)

**已核实的常见误引:**

1. **Pwn2Own Automotive 历届数字**(引用率极高,讹传也多,以下经 ZDI 官方博客实访核对):2024 东京首届 **49 个 0day / $1,323,750**;2025 **49 个 / $886,250**;2026 **76 个 / $1,047,000**。"2025 年奖金更高"、"2024 年 45 个"等说法均错;注意 0day 计数口径是"unique zero-day"。
2. **Tesla 钥匙论文是两篇不是一篇**:TCHES 2019(Wouters/Gierlichs/Piessens,DST80,Model S 钥匙)与 TCHES 2021(四人版,PKES,Model 3/超跑)——常被合并成"那个黑了特斯拉的论文",年份与目标车型必须区分;作者 Wouters 与 Starlink 攻击(03 域 #6)为同人。
3. **KeeLoq 攻击谱系别混引**:Bogdanov(RFIDSec'07,滑动攻击基础)→ Courtois/Bard/Wagner(FSE'08,代数/SAT)→ Indesteege 等(EUROCRYPT'08,实用侦听攻击)→ Eisenbarth 等(CRYPTO'08,功耗侧信道完整破)——四篇是递进关系,"一篇论文破 KeeLoq"的引用方式必然张冠李戴。
4. **Hitag2 主线论文**:《Gone in 360 Seconds》(USENIX Sec'12, Verdult/Garcia/Balasch)是攻破主线;2016/2017 的后续(#14/#15)是深化,不是同一篇;副标题拼写为 HiTag2/Hitag2 不一,引用以原文为准。
5. **RollJam 是概念攻击**:Samy Kamkar 2015 年公开的是**演示级攻击与原理**(对特定滚码接收机的 jam-and-replay),不是"所有滚码系统都被开走";引用时应写"对缺乏双重防重放设计的跳码系统构成威胁"。

**存疑与隔离条目(不得作为事实引用):**

6. **CANdid(USENIX Sec'24,#4)**:工作存在性经调研确认,精确题录与作者未钉死——引用前查 USENIX '24 program。
7. **Beneath the Bonnet(#3)**:论文存在(ESORICS 2018)与主题可信,完整副标题/作者名单未取得——以 ACM DL 复核后再引。
8. **SoK 2025(#24)**:仅检索线索,题录全未钉死,已隔离。
9. **Keen Lab 报告(#21)**:事件与官方致谢多源可信;实验室官网当前页面结构与具体报告 URL 未逐条核对。
10. **DST80 论文 TCHES 卷期**:2019 年第 2 期的判断来自检索结果,页码/文章号未细核;同样 TCHES 2021(3) 的文章号(#17 URL)未逐一验证——引用时以 tches.iacr.org 检索结果为准。
11. **0x29 认证服务部署率**:"部署率低"为综述性常识论断(2020 版引入、存量车基本没有),本库未收集到量化数据条目,需引用时找实测论文支撑。
