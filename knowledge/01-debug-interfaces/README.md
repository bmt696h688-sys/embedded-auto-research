# 01 · 调试接口攻击面

> 由调研 agent 于 2026-09-30 联网搜集(Parallel MCP web 搜索 + GitHub/HN/StackExchange API + 官方 URL 实访)，每条资源均经权威 URL 实访或官方域名检索核验，元数据(标题/作者/年份/出处)与来源一致方计入清单；GitHub star 数为当日快照。

## 方法地图

```
调试接口攻击面 (JTAG / SWD / UART / SPI / I2C)
│
├── 1. 物理侦察与引脚识别
│   ├── PCB 考古: 测试点 / 过孔 / 空焊盘 / 丝印 (TX/RX/CLK/IO)
│   ├── 电气特征: 万用表找 VCC/GND、UART 空闲高电平、逻辑分析仪猜波特率
│   ├── 自动化枚举: JTAGulator (IDCODE/BYPASS 扫描)、JTAGenum (Arduino/RPi)
│   └── 总线嗅探: SPI/I2C 逻辑分析仪抓包 → 定位 flash / EEPROM / PMIC
│
├── 2. JTAG (IEEE 1149.1 TAP)
│   ├── TAP 16 态状态机 + IR/DR 扫描链
│   ├── IDCODE 枚举 → 芯片型号; BYPASS 链长 → 链上器件数
│   ├── 边界扫描 (EXTEST) → 直接驱动/采样引脚, 绕过 SoC 逻辑
│   ├── 未使能调试口: 复位/上电时序、隐藏 TAP、eFuse 熔断
│   └── on-chip debug 接管: OpenOCD halt CPU → 内存/寄存器 dump (密码、密钥)
│
├── 3. SWD (ARM SW-DP / ADIv5)
│   ├── 2 线 (SWDIO/SWCLK) + DP→AP (AHB-AP/Mem-AP) 直接访存
│   ├── 调试锁: STM32 RDP、nRF52 APPROTECT、其他 vendor lock 位
│   ├── 复活术: 上电/复位电压毛刺 (nRF52 DEC1 掉电时序 → APPROTECT 失效)
│   └── 新硬仗: TrustZone-M 调试域隔离、RDP2 / 硬化 APPROTECT
│
├── 4. UART / SPI / I2C
│   ├── UART: boot log → root shell; 波特率与引脚识别; 未授权控制台
│   ├── SPI: NOR/NAND flash 直读 (flashrom + 编程器/SOIC 夹具, in-circuit vs 脱焊)
│   └── I2C: EEPROM / 传感器 / PMIC 配置读取与篡改
│
├── 5. 读保护绕过 (RDP / APPROTECT bypass)
│   ├── STM32: L0(全开) / L1(调试读禁止, 降级即擦除) / L2(永久)
│   │   ├── WOOT'17 (F0): 调试接口竞态 + UV-C 光故障降级 L2→L1
│   │   ├── WOOT'20 (F1): 电压毛刺 + FPB 注入 → RDP1 下 dump
│   │   └── 2024–25: SECGlitcher / Anvil (F401) / picopwner (Pico 平价复现)
│   └── nRF52 APPROTECT: LimitedResults 2020 上电毛刺复活 SWD
│
└── 6. 探针与基础设施 (自身也是攻击面)
    ├── 开源: OpenOCD + ST-Link / Bus Pirate / Glasgow / Tigard
    ├── 商用探针漏洞: ST-Link V2-1 固件缓冲区溢出 (2020)
    └── J-Link 克隆检测/变砖争议 (Segger 反克隆固件, 2015→2020)
```

**本域复现锚点**: `../../reproductions/jtag_tap.js`(IEEE 1149.1 TAP 状态机+扫描链枚举完整仿真)、`../../reproductions/stm32_bootloader.js`(AN3155 UART bootloader 协议与 RDP 拦截仿真)

## 领域综述

调试接口是嵌入式设备暴露给物理接触者的第一攻击面。IEEE 1149.1 JTAG 最初为板级边界扫描测试而生，但其 TAP 扫描链天然提供了对芯片内部的高可控性与高可观测性：IDCODE 可枚举器件、边界扫描寄存器可直接驱动引脚，而厂商挂在 TAP 上的调试模块(ARM 的 EmbeddedICE/CoreSight、各家 OCD)更可 halt CPU、读写任意内存——固件、密钥、口令随之暴露。Rosenfeld & Karri 在 2010 年的 IEEE Design & Test 综述中系统总结了"JTAG 攻与防"，是该方向被引最多的奠基文献；后续学术脉络集中在三条线：以扫描链/调试口为侧信道或注入入口的芯片级攻击(Rajput & Maniatakos IOLTS 2019 把 JTAG 同时用作攻击与防御工具)、对具体 MCU 家族安全概念的解剖(Obermaier 等 WOOT'17 对 STM32F0、WOOT'20 对 STM32F1 及其兼容/克隆芯片)，以及对整个 Cortex-M 生态的系统化(SoK @ WOOT'24 分析 689 颗芯片、1797 份固件，把调试口列为本地攻击主通道；Ravi & Bhasin NEWCAS 2025 专门综述 STM32 RDP 的攻防)。SWD 作为 ARM 的 2 线调试口是当代 Cortex-M 的事实标准，其 SW-DP/Mem-AP 体系与 JTAG 同源同险，且绕过研究(nRF52 APPROTECT 复活、RDP 毛刺降级)已是本域最活跃的工程方向。

工程实践侧，攻击通常从"板子上的四个孔/几个测试点"开始：JTAGulator/JTAGenum 自动枚举引脚，Bus Pirate/Glasgow/Tigard/Shikra 等多协议工具充当 UART/SPI/I2C 侦察与 flash dump 的瑞士军刀，OpenOCD 则是把探针变成调试服务器的枢纽。量产板残留调试口造成真实损失的案例很多：Portcullis 2018 年在 BroadLink RM Pro 上经 JTAG 用 OpenOCD 从 RAM 直接抠出 Wi-Fi 口令;VoidStar 2019 年对 TP-Link Archer A7 仅凭万用表+逻辑分析仪找到 UART root shell 并 dump SPI flash;Dennis Giese 在 DEF CON 27 IoT Village 展示了从二手智能家居设备中提取用户数据。读保护绕过则从实验室走向了"DIY 价位"：WOOT'20 的毛刺+FPB 攻击被 stm32f1-picopwner 用一只树莓派 Pico(数美元)完整复现，SECGlitcher 与 Anvil Secure 分别用 ChipWhisperer 在 2024/2025 年展示可复现的 RDP 绕过，而 2025 年 hardwear.io 的 STM32-TraceRip 甚至表明不毛刺、走 trace 端口也能提取受保护 flash。防御侧的对应物是 RDP2/硬化 APPROTECT(flash 熔丝级不可逆)、secure JTAG 认证(AUTOTESTCON 2019、Schnorr 认证模型)与"量产板不留调试口"的最朴素纪律——但每一次"复活术"(LimitedResults 2020)都在提醒这些锁的工程实现仍会输给一根足够准的电源毛刺。

## 资源清单

| # | 标题 | 作者 | 年份 | 出处/类型 | URL | 内容与重要性 | 验证证据 | 置信度 |
|---|------|------|------|-----------|-----|--------------|----------|--------|
| 1 | Attacks and Defenses for JTAG | Kurt Rosenfeld, Ramesh Karri | 2010 | IEEE Design & Test of Computers 27(1):36-47 / 期刊论文 | https://www.computer.org/csdl/magazine/dt/2010/01/mdt2010010036/13rRUxCitF8 | JTAG 安全的开山综述：恶意芯片经 JTAG 链注入、扫描链侧信道、以及 secure JTAG 防御设计，本域引用频率最高的奠基文献 | 经 computer.org 检索页与 ACM Computing Surveys 引文(27,1,2010,36-47)双源核对卷期页码 | 高 |
| 2 | Shedding too much Light on a Microcontroller's Firmware Protection | Johannes Obermaier, Stefan Tatschner (Fraunhofer AISEC) | 2017 | USENIX WOOT '17 / 论文 | https://www.usenix.org/conference/woot17/workshop-program/presentation/obermaier | 首次系统解剖 STM32(F0)读保护：Cold-Boot Stepping、配置存储缺陷致保护降级、调试接口竞态直接提取受保护固件；关联 CVE-2017-18347 | WebFetch USENIX 议程页(标题/作者/机构/三大弱点全符);CVE 号经 Fraunhofer AISEC 项目页交叉核对 | 高 |
| 3 | One Exploit to Rule them All? On the Security of Drop-in Replacement and Counterfeit Microcontrollers | Johannes Obermaier, Marc Schink, Kosma Moczek | 2020 | USENIX WOOT '20 / 论文 | https://www.usenix.org/conference/woot20/presentation/obermaier | 分析 4 厂商 6 颗 STM32F1 及其替换/仿冒芯片：每颗都存在新漏洞可暴露全部固件；其中 STM32F1 的电压毛刺+FPB(Flash Patch Breakpoint)攻击是 picopwner 等廉价复现的源头 | WebFetch USENIX 演讲页核对标题/作者/摘要；PDF 与幻灯片(usenix woot20-paper16-slides)另经检索核对 | 高 |
| 4 | JTAG: A Multifaceted Tool for Cyber Security | P. H. N. Rajput, M. Maniatakos (NYU AD) | 2019 | IEEE IOLTS 2019, pp.155-158 / 会议论文 | https://sites.nyuad.nyu.edu/ccs-ad/?publications=jtag-a-multifaceted-tool-for-cyber-security | 把 JTAG 同时作为攻击载体与安全工具的双面研究，代表学术侧"调试口即武器库"视角 | NYU AD CCS 官网条目(IEEE 25th IOLTS, 2019-07)与 dblp(IOLTS 2019: 155-158)双源一致 | 高 |
| 5 | SoK: Where's the "up"?! A Comprehensive (bottom-up) Study on the Security of Arm Cortex-M Systems | Xi Tan, Zheyuan Ma, Sandro Pinto, Le Guan, Ning Zhang, Jun Xu, Zhiqiang Lin, Hongxin Hu, Ziming Zhao | 2024 | USENIX WOOT '24, pp.149-169 / SoK | https://www.usenix.org/conference/woot24/presentation/tan | Cortex-M 安全系统化知识：硬件安全缺陷(含调试口/毛刺/外设本地攻击面)+ 1797 份真实固件实证 + 防御措施评估，本域最佳现代地图 | WebFetch USENIX 页核对完整作者名单与页码；arXiv:2401.15289 交叉核对(含"debug ports"攻击假设) | 高 |
| 6 | Firmware Pitfalls: On Compromising Flash Readout Protection in STM32 Devices | Prasanna Ravi, Shivam Bhasin | 2025 | 23rd IEEE Interregional NEWCAS, pp.108-112 / 会议论文 | https://ieeexplore.ieee.org/document/11107115 | 最新 STM32 RDP 攻防综述论文，梳理 RDP1/RDP2 的各类绕过路径，衔接 WOOT'17/'20 到当下的完整脉络 | IEEE Xplore 作者页与 Semantic Scholar 条目(NEWCAS 2025, 108-112)双源一致；IEEE 摘要页直访被拒，未取全文 | 中 |
| 7 | Mitigating JTAG as an Attack Surface | (作者未核) | 2019 | IEEE AUTOTESTCON 2019 / 会议论文 | https://ieeexplore.ieee.org/document/8961076 | 防御视角：把 JTAG 作为在役系统攻击面的量化分析与缓解框架，适合做防御侧参考 | IEEE Xplore 检索摘录确认标题与 venue(2019 IEEE AUTOTESTCON);作者名单未取得 | 中 |
| 8 | Serial Wire Debug and the CoreSight Debug and Trace Architecture | E. Ashfield, I. Field, P. Harrod, S. Houlihane, W. Orme, S. Woodhouse (ARM Ltd) | ~2005(未核) | ARM 技术白皮书 | https://community.nxp.com/pwmxy87654/attachments/pwmxy87654/imxrt/4786/2/Serial_Wire_Debug.pdf | SWD 的原始文献：2 线调试接口的设计动机、SW-DP/CoreSight 架构——理解 SWD 攻击面的第一手资料 | 经 NXP 社区托管 PDF 的检索摘录核对标题/作者/摘要；原始发表 venue 与年份未能核实 | 中 |
| 9 | nRF52 Debug Resurrection (APPROTECT Bypass) Part 1 & Part 2 | LimitedResults | 2020 | limitedresults.com / 博客系列(另出 Black Hat EU 2020 版) | https://www.limitedresults.com/results/nrf52-debug-resurrection-approtect-bypass | SWD"复活术"标杆：对 nRF52840 用上电电压毛击穿 APPROTECT 时序，复活 SWD 调试口(Part 1, 06-10);复活后经 Mem-AP 提取固件(Part 2, 06-14) | WebFetch limitedresults.com/results 页逐条核对两篇标题与日期(06-10/06-14, 确认无 Part 3);BH EU 2020 幻灯片 PDF 另经检索核对 | 高 |
| 10 | Debug Resurrection on nRF52 Series | LimitedResults | 2020 | Black Hat Europe 2020 / 会议演讲 | https://limitedresults.com/wp-content/uploads/2020/12/eu-20-Limiteresults-Debug-Resurrection-On-nRF52-Series.pdf | 同一研究的会议版幻灯片，含 OpenOCD 脚本化 dump 流程，适合直接照做 | 官方 PDF 经检索摘录核对标题/讲者/议程内容 | 高 |
| 11 | Journey Into JTAG | Ryan Grachek | 2025 | hardwear.io USA 2025 (Santa Clara, 5/27-31) / 会议演讲 | https://hardwear.io/past-events/hardwear-io-security-trainings-and-conference-usa-2025/ | 对高通 APQ8064(三星 Galaxy S4)的完整 JTAG 利用旅程：从引脚到 SoC 调试接管，2025 年本域最具代表性的方法论演讲；PPTX 与 YouTube 视频公开 | WebFetch hardwear.io 官方议程页(含讲者/演示文稿/视频链接)；eshard 回顾博客与 YouTube 链接交叉核对 | 高 |
| 12 | Tracing the Untraceable: Extracting Protected Flash with STM32-TraceRip | Mark Omo, James Rowley | 2025 | hardwear.io USA 2025 / 会议演讲 | https://hardwear.io/past-events/hardwear-io-security-trainings-and-conference-usa-2025/ | 不靠毛刺、经 trace 端口提取 RDP 受保护 STM32 flash 的新路数——读保护绕过在 2025 年的最新变体 | WebFetch hardwear.io 官方议程页确认标题与讲者；技术细节未进一步核验 | 高 |
| 13 | SECGlitcher (Part 1) – Reproducible Voltage Glitching on STM32 Microcontrollers | Gerhard Hechenberger, Steffen Robertz (SEC Consult Vulnerability Lab) | 2024-01-11 | sec-consult.com / 博客 | https://sec-consult.com/blog/detail/secglitcher-part-1-reproducible-voltage-glitching-on-stm32-microcontrollers/ | 可复现工程化：ChipWhisperer crowbar 毛刺，STM32L073 命令行认证绕过 + STM32F429 经 bootloader 读取 RDP1 固件(通宵 622 次成功毛刺 dump 155KB);Part 2 预告 RDP2→RDP1 降级 | WebFetch SEC Consult 官方博客核对作者/日期/芯片型号/RDP 级别 | 高 |
| 14 | Glitching STM32 Read Out Protection with Voltage Fault Injection | Luigi Fragale (Anvil Secure) | 2025-04-18 | anvilsecure.com / 博客 | https://www.anvilsecure.com/blog/glitching-stm32-read-out-protection-with-voltage-fault-injection.html | STM32F401CC 上用 ChipWhisperer-Lite 打 VCAP_1 跳过 bootloader RDP 检查，约 6 小时毛刺提取全部固件(含硬编码密钥)；明确区分 RDP1/RDP2 | WebFetch Anvil 官方博客核对作者/日期/目标芯片/毛刺硬件/RDP 级别 | 高 |
| 15 | Dumping the ST-LINK/V2-1: an exploration into buffer overflows and lack of input validation | cyanic (GMMan) | 2020-12-23 | GitHub 论文(st-link-hack) / 技术报告 | https://github.com/GMMan/st-link-hack/blob/master/paper/paper.md | 调试探针自身成为攻击面：ST-Link V2-1 固件缓冲区溢出与输入校验缺失分析(起因是 Game & Watch 挖掘)，JTAG/SWD 基础设施安全代表案例 | 经 GitHub 仓库内论文全文检索摘录核对标题/作者/日期 | 中 |
| 16 | Privacy leaks in smart devices: Extracting data from used smart home devices | Dennis Giese | 2019 | DEF CON 27 IoT Village / 会议演讲 | https://www.youtube.com/watch?v=Iit4SmzQ2Uo | 量产设备数据残留的代表作：混合软件 root 与硬件 flash dump 从二手设备提取用户隐私；同讲者另有 DC26 IoT Village 的 Xiaomi Cortex-M 固件修改教程 | WebFetch dontvacuum.me/talks(讲者官方页)核对 DC27 IoT Village 标题与日期；YouTube 视频页存在性经检索核对 | 高 |
| 17 | JTAG on-chip debugging: Extracting passwords from memory | ISA (Portcullis Labs) | 2018-03-29 | labs.portcullis.co.uk / 博客 | https://labs.portcullis.co.uk/blog/jtag-on-chip-debugging-extracting-passwords-from-memory/ | 量产板残留 JTAG 的经典实战：BroadLink RM Pro 上用 JTAGulator 定引脚 + Shikra + OpenOCD halt 后 dump RAM,定位 Wi-Fi 口令；流程完整可照抄 | WebFetch 原文核对作者/日期/设备(JTAGulator+Shikra+OpenOCD 流程)/结论 | 高 |
| 18 | Router Analysis Part 1: UART Discovery and SPI Flash | Matthew Alt (wrongbaud, VoidStar Security) | 2019-10-07 | voidstarsec.com / 博客 | https://voidstarsec.com/blog/router-teardown | 无 JTAGulator 条件下的方法论示范：TP-Link Archer A7 v5(QCA9563)上以万用表+逻辑分析仪找 UART 拿 root shell、Bus Pirate+flashrom 脱焊 dump W25Q128;binwalk 解包全流程 | WebFetch 原文核对作者/日期/路由器型号/工具链 | 高 |
| 19 | JTAGulator vs. JTAGenum, Tools for Identifying JTAG Pins in IoT Devices | Praetorian (editorial) | 2016-04-20 | praetorian.com / 博客 | https://www.praetorian.com/blog/jtagulator-vs-jtagenum-tools-for-identifying-jtag-pins-in-iot-devices | 两代引脚枚举工具的横向对比($200 JTAGulator vs Arduino 版 JTAGenum),入门选型必读 | 官方博客检索摘录核对标题与日期(2016-04-20);HN 同文讨论交叉印证 | 高 |
| 20 | Hardware Hacking 101: Identifying and Verifying JTAG on a Device | Sue Mohieldin (Riverloop Security) | 2021-05-27 | riverloopsecurity.com / 博客教程 | https://riverloopsecurity.com/blog/2021/05/hw-101-jtag-part2/ | HW101 系列的 JTAG 实操篇：识别→验证→接 OpenOCD,社区公认的温柔入门教程 | 官方博客检索摘录核对作者与日期 | 高 |
| 21 | A Hacker's Guide To JTAG | Tom Nardi (Hackaday) | 2020-04-08 | hackaday.com / 科普长文 | https://hackaday.com/2020/04/08/a-hackers-guide-to-jtag/ | 从标准讲到攻击者视角的单篇综述，中文圈也常转译引用；另有同站《The Many Faces Of JTAG》(2016-12) | Hackaday 官方文章检索摘录核对作者与日期 | 高 |
| 22 | stm32f1-picopwner | CTXz (Patrick Pedersen) | 2023(2024-04 最后更新) | GitHub / 开源工具 | https://github.com/CTXz/stm32f1-picopwner | 用树莓派 Pico 复现 WOOT'20 的毛刺+FPB 攻击，绕过 STM32F1 RDP1 dump 固件——把实验室级攻击压到数美元 DIY 门槛，本域最著名开源复现 | WebFetch 仓库页(README 自述实现 Obermaier/Schink/Moczek 攻击)+ GitHub API(created 2023-05-23, pushed 2024-04-01, 330★)双源核对 | 高 |
| 23 | f103-analysis(原始攻击补充材料) | Johannes Obermaier 等 | 2020 | GitHub / 论文配套代码 | https://github.com/JohannesObermaier/f103-analysis | WOOT'20 论文官方补充材料与原始 PoC,picopwner 的上游 | GitHub 元数据检索摘录核对(README 注明对应论文，created 2020-08-11, 112★) | 高 |
| 24 | Microcontroller Exploits | Travis Goodspeed | 2024 | No Starch Press / 书籍(408pp, ISBN 9781718503885) | https://nostarch.com/microcontroller-exploits | 本域权威专著：JTAG/ROM/Flash bootloader 提取、STM32F217 DFU 逃逸、Ledger Nano S、STM32 FPB 毛击(第 17 章)、芯片开封等，实操密度极高 | No Starch 官网(2024, 408pp, ISBN)与 O'Reilly 平台(Travis Goodspeed, 2024, 408 页，含章节目录)多源一致 | 高 |
| 25 | The Hardware Hacking Handbook: Breaking Embedded Security with Hardware Attacks | Jasper van Woudenberg, Colin O'Flynn | 2021 | No Starch Press / 书籍(512pp, ISBN 9781593278748) | https://nostarch.com/hardwarehacking | 硬件攻击"教材级"全景书：威胁建模、接口与协议攻击、故障注入与侧信道，调试口章节是本域体系化入门首选 | No Starch 官网检索摘录(2021-11, 512pp, ISBN)与 Penguin Random House/Hackaday 书评多源一致 | 高 |

## 工具与资源

(star 数与最近推送均为 2026-09-30 GitHub API/页面快照)

| 名称 | 用途 | URL | 验证情况 |
|------|------|-----|----------|
| JTAGulator | 自动发现板上 JTAG/SWD/UART 引脚(IDCODE/BYPASS 扫描，24 通道)；Joe Grand / Grand Idea Studio 设计，2025-07 起由 EXPLIoT 制造维护 | https://github.com/grandideastudio/jtagulator | WebFetch 仓库页：808★/114 fork,README 含 EXPLIoT 维护声明；expliot.io/jtagulator 产品页交叉核对 |
| Glasgow Interface Explorer | iCE40 FPGA 多协议瑞士军刀(UART/SPI/I²C/JTAG/SWD + 逻辑分析仪)，Amaranth HDL，全开源工具链 | https://github.com/GlasgowEmbedded/glasgow | GitHub API:2219★,最近推送 2026-09-29;WebFetch Crowd Supply 页：Piotr Esden-Tempski(esden)/1BitSquared/whitequark,2021-02 众筹 $458k,RevC |
| HydraBus / HydraFW | 开源多协议多工具(SPI/I2C/UART/JTAG/NFC via HydraNFC),STM32 平台，Benjamin Vernoux 主导 | https://github.com/hydrabus/hydrafw | GitHub API:hydrafw 451★(推送 2026-01-30)、hydrabus 355★(2024-03-16);hydrabus.com 与 DigiKey(benjamin-vernoux)核对作者 |
| Bus Pirate 5 | Ian Lesnet(Dangerous Prototypes)2008 年始祖工具的 RP2040 重生版，2023-08 发布(与 Sjaak 合作)；5XL/6 已上 RP2350 | https://github.com/DangerousPrototypes/BusPirate5-firmware | GitHub API:firmware 265★(推送 2026-09-23)、hardware 123★;buspirate.com《The Bus Pirate v5 Saga》(2023-08-02)与 Wikipedia 交叉核对 |
| Tigard | FT2232H 多协议硬件黑客工具(USB-JTAG/SPI/UART/I2C),探针友好 | https://github.com/tigard-tools/tigard | 检索镜像 GitHub 元数据：869★,created 2020-05-14;Brown Fine Security 博客实战交叉印证 |
| Shikra | Xipiter 出品的 FT232H 多协议工具(UART/JTAG/SPI/I2C/GPIO),Portcullis 案例用件 | https://github.com/shikras/shikra | GitHub API:816★,推送 2024-07-08;Xipiter/shikra-programmer 与 int3.cc 线索核对 |
| GreatFET | Great Scott Gadgets 的 FT2232H 平台，Facedancer USB 模拟生态 | https://github.com/greatscottgadgets/greatfet | GitHub API:354★,推送 2026-08-21 |
| JTAGenum | Arduino/RPi 上扫描 JTAG 引脚并枚举 IR 指令寄存器，cyphunk 原作(致谢更早的 JTAG scanner 与 Arduinull) | https://github.com/cyphunk/JTAGenum | 检索镜像 GitHub 元数据：777★/111 fork,README 致谢链核对;go-jtagenum(gremwell, Go 移植， 107★)交叉印证 |
| OpenOCD | 开源片上调试服务器(JTAG/SWD → GDB/Telnet),一切 dump 流程的中枢 | https://github.com/openocd-org/openocd | GitHub API:2338★,推送 2026-09-26(官方只读镜像) |
| stlink | 开源 ST-Link 主机工具(烧录/dump) | https://github.com/stlink-org/stlink | GitHub API:5180★,推送 2026-09-28 |
| flashrom | SPI/并口 flash 读写事实标准(支持 buspirate_spi 等编程器后端) | https://github.com/flashrom/flashrom | GitHub API:1174★,推送 2026-09-29 |
| PicoGlitcher | Matthias Kesenheimer 的 RP2040 电压毛刺器(可购于 faultyhardware.de),复现 SECGlitcher 类 STM32/ESP32 攻击 | https://github.com/MKesenheimer/PicoGlitcher | 检索镜像 GitHub 元数据：44★,created 2021-05-28;hackaday.io/project/196357 与 Hackaday 报道交叉核对 |
| stm32f1-picopwner | 见资源清单 #22;与 PicoGlitcher 并列的两大平价毛刺复现平台 | https://github.com/CTXz/stm32f1-picopwner | GitHub API + WebFetch 双源 |
| ESP32-Bit-Pirate | 新兴 ESP32 多协议硬件黑客工具(Web CLI),2025-26 增长极快 | https://github.com/geo-tp/ESP32-Bit-Pirate | GitHub API:5930★,推送 2026-09-29;细节未深查 |
| J-Link / ST-Link 商用探针(含克隆争议) | 事实标准商用探针；Segger 自 J-Link 软件 V4.7 时代起检测克隆并刷入"blinky"固件致其变砖，2020-12 Hackaday 报道 V9 变砖自救；ST-Link V2-1 固件本身亦有溢出(见清单 #15) | https://hackaday.com/2020/12/30/unbricking-a-segger-j-link-v9-debug-probe/ | Hackaday(2020-12-30, Maya Posch)、Emil 原帖(2019-05-15, uglyduck.vajn.icu)、Nordic DevZone 讨论、gronlier.fr(2015 V8 克隆自救)多源交叉 |
| HackTricks – Hardware Hacking | 调试口/固件提取手法速查(UART/JTAG/SPI 检测流程) | https://hacktricks.wiki/en/todo/hardware-hacking/index.html | 官方域名检索摘录核对其 JTAG 章节内容(24 通道 IDCODE/BYPASS 描述与 JTAGulator 文档一致) |
| ELVIS Wiki: JTAGulator Introduction | 奥地利 ELVIS 实验室的 JTAGulator 上手 wiki(含命令示例) | https://wiki.elvis.science/index.php?title=JTAGulator%3A_Introduction | 检索摘录核对结构与内容 |

## 入门路径

1. **读两篇入门文**：Hackaday《A Hacker's Guide To JTAG》(清单 #21)+ Wikipedia JTAG 条目，建立 TAP 状态机/IDCODE/BYPASS/边界扫描的概念。
2. **备一件多协议工具**：预算有限买 Bus Pirate 5,常规选 Tigard 或 Shikra；要 JTAG/SWD 深度玩可上 Glasgow;确认目标芯片手册里的调试引脚。
3. **练引脚识别**:Riverloop《Hardware Hacking 101: JTAG 篇》(#20)照做一遍；有 Arduino 就跑 JTAGenum,有预算再上 JTAGulator;UART 识别按 VoidStar 教程(#18)用万用表+逻辑分析仪。
4. **第一次 dump**:OpenOCD + ST-Link 对 STM32 Nucleo 板执行 connect/halt/dump_image;SPI flash 用 flashrom + 编程器(注意 in-circuit 读不动就脱焊)。
5. **研读实战案例**:Portcullis BroadLink(#17)→ VoidStar Archer A7(#18)→ Dennis Giese DC27(#16),体会量产板残留调试口的真实影响。
6. **啃学术主线**:WOOT'17(#2)→ WOOT'20(#3)→ SoK WOOT'24(#5),配合 Goodspeed《Microcontroller Exploits》(#24)第 1/2/17 章与《The Hardware Hacking Handbook》(#25)。
7. **复现读保护绕过**：先用 stm32f1-picopwner(#22,一只 Pico)或 PicoGlitcher+SECGlitcher(#13)打 RDP1;再读 Anvil(#14)理解 RDP2 降级的边界。
8. **专向深入**:nRF52 APPROTECT 复活(#9/#10)、STM32-TraceRip 与 Journey Into JTAG(#11/#12)、ST-Link 探针自身漏洞(#15)。
9. **切防御视角**:AUTOTESTCON 2019(#7)、Nordic"improved APPROTECT"实践(纠错 #13)、secure JTAG 认证方案，以及最朴素的"量产不留调试口/默认 RDP2"纪律。

## 纠错与存疑(引用本域资源前必读)

**已证实的常见误引：**

1. **stm32f1-picopwner 年份**：GitHub API 显示仓库创建于 **2023-05-23**,最后推送 2024-04-01。"2024 年发布"的说法不准确——应表述为"2023 年 5 月发布、2024 年 4 月最后更新"。作者为 GitHub 用户 CTXz(GitHub 主页署名 Patrick Pedersen,单一来源，中等置信)。
2. **picopwner 的攻击出处**：它实现的是 **WOOT'20** 论文《One Exploit to Rule them All?...》(Obermaier/Schink/Moczek)中对 STM32F1 的毛刺+FPB 攻击，**不是** 2017 年那篇(F0,竞态+UV-C)。两篇常被混引——2017 那篇的 CVE 是 2017-18347,目标是 STM32F0。
3. **APPROTECT 绕过是 LimitedResults 哪篇**：是《nRF52 Debug Resurrection (APPROTECT Bypass)**Part 1**》(2020-06-10,nRF52840 上电毛刺复活 SWD);**Part 2**(2020-06-14)讲复活后的固件提取；**没有 Part 3**;BH EU 2020 幻灯片是会议版。常见错误：把 Part 2 当作绕过篇、或臆造 Part 3。
4. **JTAGulator 作者**:Joe Grand / **Grand Idea Studio**(注意不是复数 "Studios");自 2025 年 7 月起由 **EXPLIoT** 制造维护(README 与 expliot.io 双源)。JTAGenum 原作是 **cyphunk**,README 致谢更早的 JTAG scanner 与 Arduinull;cybergibbons 的 fork 流传也很广，引用时注意区分主仓。
5. **Journey Into JTAG 的归属**:是 **hardwear.io USA 2025**(2025-05-27~31,Santa Clara Marriott)的演讲，讲者 **Ryan Grachek**,案例为高通 APQ8064(三星 Galaxy S4)——不是 DEF CON 演讲。STM32-TraceRip(Mark Omo & James Rowley)同样出自该届。
6. **SECGlitcher Part 1 的能力边界**:Part 1(2024-01-11)演示的是 **RDP1** 固件读取(bootloader 阶段毛刺)与命令行认证绕过；RDP2→RDP1 降级是官方预告的 Part 2 内容。ST 社区帖等处存在把 Part 1 直接引作"RDP2 绕过"的情况。
7. **Rosenfeld & Karri (2010) 卷期**:IEEE Design & Test of Computers, Vol.27, No.1, pp.36-47, DOI 10.1109/MDT.2010.9——computer.org、ACM 引文、academia 引用三处一致。

**存疑条目(引用需谨慎)：**

8. **"Tinfoil" 论文**：调研任务中提到的 "Obermaier/Tinfoil" 未能检索到任何对应文献；Obermaier 在本域的相关论文即 WOOT'17 与 WOOT'20 两篇。视为线索性误引，勿写入正式引用。
9. **ARM《Serial Wire Debug and the CoreSight Debug and Trace Architecture》**(清单 #8):作者(Ashfield 等 6 人，ARM Ltd)与内容经 NXP 社区托管的 PDF 确认，但**原始发表 venue 与年份未核实**(常被标注为约 2005 年的 ARM 白皮书)。
10. **《Mitigating JTAG as an Attack Surface》**(清单 #7):venue(2019 IEEE AUTOTESTCON)与标题经 IEEE Xplore 确认，**作者名单未能核实**。
11. **STM32-TraceRip**(清单 #12):仅经 hardwear.io 官方议程页验证标题与讲者，方法细节与代码发布情况未进一步核实。
12. **RDP 语义提醒**:RDP1→RDP0 会触发整片擦除；RDP2 设计上不可逆。但毛刺攻击打的是**选项字节比较的时序**而非"解密"，且 option byte 编码(如 F1 的 RDP 开键值)随系列(F0/F1/F4/L0)差异很大——引用任何"绕过 RDP"的结论时务必注明具体型号与芯片修订版(WOOT'20 已证明原厂与替换/仿冒芯片行为不同)。
13. **数据快照说明**:GitHub star 数为 2026-09-30 快照；本环境 GitHub API 为共享出口 IP、限额波动，其中 JTAGenum(777★)、Tigard(869★)、f103-analysis(112★)、PicoGlitcher(44★)取自搜索引擎镜像的 GitHub 元数据，可能滞后数周，引用精确数字前建议复核。
