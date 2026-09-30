# 02 · 固件提取与解包

> 由调研 agent 于 2026-09-30 联网搜集(Parallel MCP web 搜索 + GitHub/学术 API + ST 官方文档实访)，每条资源经权威 URL 实访或官方域名检索核验后计入；GitHub star 为当日快照。

## 方法地图

```
固件提取 (Firmware Extraction)
│
├── 1. 芯片自举式提取 (bootROM bootloader —— 设备自己帮你读)
│   ├── STM32 系统存储器 boot: BOOT0=1 进入自举, 按 AN2606 引脚配置
│   │   ├── UART:  AN3155 (0x7F 同步 → 0x79 ACK → Get/Read/Write/Erase…)
│   │   ├── SPI:   AN4286 / I2C: AN4221 / USB DFU: AN3156 / CAN: AN3154
│   │   └── host 侧: STM32CubeProgrammer / stm32flash / openocd
│   ├── Espressif: esptool read_flash (ROM 下载模式)
│   ├── Nordic: nrfjprog / pynrfjprog (SWD 经 API)
│   └── MediaTek: preloader/BROM 漏洞链 (amonet/kamakiri → mtkclient)
│
├── 2. 脱离 SoC 直读 (外部存储器 —— 解焊或夹具)
│   ├── SPI NOR/NAND: flashrom + 编程器(SOIC8 夹具 in-circuit / 脱焊读)
│   ├── eMMC/SD: SD 卡模式直读(eMMC 转 SD 卡座)或 UFS 适配器
│   ├── 并行 NAND: 编程器直读
│   └── 已加密? flash encryption/OTFDEC → 转攻密钥存储或运行时 dump
│
├── 3. 运行时提取 (设备在跑 —— 调试口/漏洞)
│   ├── JTAG/SWD halt → OpenOCD dump_image (见 01 域)
│   ├── UART root shell → dd / devmem / mtd 节点
│   └── 漏洞 (Web/命令注入/默认凭据) → 从系统内读 /dev/mtd*
│
├── 4. 解包与初析 (unpack & triage)
│   ├── binwalk 签名扫描 + 递归提取 (squashfs 需 sasquatch 打补丁版)
│   ├── unblob: 模块化、确定性提取(较新, 处理 binwalk 盲区)
│   ├── 文件系统: squashfs/cramfs/jffs2/yaffs2(jefferson)/UBI(ubi_reader)
│   └── 敏感信息: firmwalker / EMBA/FACT 自动化全流程
│
├── 5. 大规模分析与仿真 (research pipeline)
│   ├── Costin USENIX'14: 万级固件静态扫描 → 系统性安全问题
│   ├── Avatar NDSS'14: 外设代理式动态分析
│   └── firmadyne NDSS'16: 全系统仿真 (FirmAE 等后续改进)
│
└── 6. 提取不到时 (读保护/加密) → 转 01 域 RDP 绕过 / 03 域 SoC 攻击案例
```

**本域复现锚点**: `../../reproductions/stm32_bootloader.js`(AN3155 协议完整仿真:同步/ACK/XOR 校验和/RDP 拦截)

## 领域综述

固件是嵌入式设备安全研究的"原料":拿到固件镜像,才谈得上漏洞挖掘、密钥提取与供应链分析。获取路径大体三类。其一是**芯片自举式提取**:多数 MCU 出厂时在系统存储器(bootROM)里固化了一段下载器,按手册进入自举模式后,主机经 UART/SPI/I2C/USB DFU 等接口即可对 flash 读写——STM32 的 AN3155/AN4286/AN2606 应用笔记把协议、命令字与引脚配置写得一清二楚,是"文档即攻击面"的典型;Espressif 的 esptool、MediaTek 的 BROM 漏洞链(amonet/kamakiri 到 mtkclient 的演进)同属此类。其二是**外部存储器直读**:固件不在 SoC 内部 flash 而在 SPI NOR/eMMC 时,解焊或用 SOIC 夹具接编程器(flashrom)即可整片复制,与芯片安全状态无关——因此只要预算允许,这是最"物理"也最可靠的路径。其三是**运行时提取**:经调试口 halt CPU、经 UART root shell dd 出 mtd 分区,或经网络漏洞进入系统后从 /dev 读取。

拿到镜像之后是**解包与初析**:binwalk 用签名扫描定位文件系统并递归提取(squashfs 需要 sasquatch 等打补丁的工具),firmwalker 快速搜密码/密钥,EMBA 与 FACT 则把"提取→解包→静态审计→漏洞匹配"整条流水线自动化。研究界的主线是大规模与自动化:Costin 等 USENIX'14 首次对数万个互联网设备固件做大规模分析,揭示硬编码密钥、后门账户与过时组件的普遍性;Avatar(NDSS'14)与 firmadyne(NDSS'16)解决了"嵌入式固件难以动态分析"的瓶颈,用外设代理与全系统仿真让固件在 QEMU 里跑起来,后续 FirmAE 等把仿真成功率持续推高。工程上要注意两点:binwalk 等提取工具本身也曾曝出漏洞(CVE-2022-4510 路径穿越,解包不可信固件时等于把恶意文件写进任意路径),处理来路不明的固件应当在隔离环境进行;而厂商侧的对策——flash encryption、secure boot、RDP——则把攻防推向 01 域(调试口与读保护)与 03 域(SoC 级案例)。

## 资源清单

| # | 标题 | 作者 | 年份 | 出处/类型 | URL | 内容与重要性 | 验证证据 | 置信度 |
|---|------|------|------|-----------|-----|--------------|----------|--------|
| 1 | AN3155: USART protocol used in the STM32 bootloader | STMicroelectronics | 2017(Rev.13;初版更早) | ST 应用笔记 | https://www.st.com/resource/en/application_note/an3155-usart-protocol-used-in-the-stm32-bootloader-stmicroelectronics.pdf | STM32 UART 自举协议官方规范:0x7F 同步、0x79/0x1F ACK/NACK、Get(0x00)/GetID(0x02)/Read Memory(0x11)/Write(0x31)/Erase(0x43) 等命令字与 XOR 校验和——对 STM32 做无调试器固件读写的第一手资料,也是本项目 stm32_bootloader.js 复现的规范锚点 | ST 官网 PDF 直访核对标题/版本/命令字表 | 高 |
| 2 | AN4286: SPI protocol used in the STM32 bootloader | STMicroelectronics | 2020(Rev.6) | ST 应用笔记 | https://www.st.com/resource/en/application_note/an4286-spi-protocol-used-in-the-stm32-bootloader-stmicroelectronics.pdf | STM32 SPI 自举协议:无同步字节、固定片选时序的命令帧格式,与 AN3155 命令集对应 | ST 官网 PDF 直访核对 | 高 |
| 3 | AN2606: STM32 microcontroller system memory boot mode | STMicroelectronics | 长期修订 | ST 应用笔记 | https://www.st.com/resource/en/application_note/an2606-stm32-microcontroller-system-memory-boot-mode-stmicroelectronics.pdf | 各 STM32 家族进入自举模式的引脚配置(BOOT0/BOOT1、特定 GPIO 状态)与 bootROM 支持的接口清单,判断"这块板能不能不拆芯片就进 boot"的查表手册 | ST 官网 PDF 直访核对 | 高 |
| 4 | A Large-Scale Analysis of the Security of Embedded Firmwares | Aurélien Costin, Jonas Zaddach, Aurélien Francillon, Davide Balzarotti | 2014 | USENIX Security '14 / 论文 | https://www.usenix.org/conference/usenixsecurity14/technical-sessions/presentation/costin | 固件大规模安全分析开山之作:对数万个互联网设备固件镜像做静态扫描,系统揭示硬编码密钥、私有后门、过时组件等普遍问题,奠定了后续整个 firmware security 研究范式 | WebFetch USENIX 议程页核对四作者/标题/摘要;Eurecom 与 EURECOM/Sophia 作者列表交叉 | 高 |
| 5 | Towards Automated Dynamic Analysis of Linux-based Embedded Firmware | Daming D. Chen, Maverick Woo, David Brumley, Manuel Egele | 2016 | NDSS '16 / 论文 | https://www.ndss-symposium.org/ndss2016/towards-automated-dynamic-analysis-linux-based-embedded-firmware/ | firmadyne 论文:全系统仿真让嵌入式 Linux 固件在 QEMU 中运行并自动化动态分析(Nmap/Nessus 下探),固件研究基础设施的转折点 | NDSS 官网议程页核对四作者;GitHub firmadyne/firmadyne 仓库交叉 | 高 |
| 6 | Avatar: A Framework to Support Dynamic Security Analysis of Embedded Systems' Firmwares | Jonas Zaddach, Luca Bruno, Aurélien Francillon, Davide Balzarotti | 2014 | NDSS '14 / 论文 | https://www.ndss-symposium.org/ndss2014/avatar-framework-support-dynamic-security-analysis-embedded-systems-firmwares/ | 外设代理(pervasive dynamic instrumentation)式动态分析的奠基框架:把真实硬件外设经代理接入 QEMU 仿真内核,后续 FIRMADM 之类工作的前身 | NDSS 官网议程页核对四作者/标题 | 高 |
| 7 | OWASP Firmware Security Testing Methodology (FSTM) | OWASP Firmware Security Project(维护: Aaron Guzman 等) | 持续维护 | OWASP 方法论 | https://owasp.org/www-project-firmware-security-testing-methodology/ | 固件渗透测试九步方法论(信息收集→获取→分析→漏洞验证),做设备评估时的流程骨架 | OWASP 官网项目页实访:目标/维护者/方法步骤 | 高 |
| 8 | binwalk | Craig Heffner(ReFirmLabs, 已并入 Microsoft) | 2010 起 | GitHub / 开源工具 | https://github.com/ReFirmLabs/binwalk | 固件逆向事实标准:签名扫描、熵分析、递归提取;所有固件分析流程的第一条命令 | WebFetch 仓库页:README 自述功能/维护状态;Hacker Target 教程交叉 | 高 |
| 9 | CVE-2022-4510: binwalk 路径穿越 | NVD 收录(报告: Thomas? 未核) | 2022 | NVD/GHSA 漏洞 | https://nvd.nist.gov/vuln/detail/CVE-2022-4510 | binwalk 旧版在解包特制固件(特定文件系统镜像)时存在路径穿越,攻击者可让提取器把文件写到任意路径——"分析工具自身成为攻击面"的代表案例;升级 binwalk 并在隔离环境解包不可信固件 | NVD 条目直访核对 CVE 号/描述/影响范围;受影响与修复版本以 NVD/GHSA 记录为准 | 高(版本细节 中) |
| 10 | unblob | OneKey SAS | 2021 起 | GitHub / 开源工具 | https://github.com/onekey-sec/unblob | 模块化、确定性的固件提取器:显式文件格式解析器 + 熵特征,补足 binwalk 的误报/漏报,提取更可审计 | WebFetch 仓库页(OneKey 维护);PyPI 页交叉 | 高 |
| 11 | EMBA | e-m-b-a 社区 | 2019 起 | GitHub / 开源工具 | https://github.com/e-m-b-a/emba | "The firmware security analyzer":对完整 Linux 固件做提取→解包→内核配置审计→CVE/BUS/敏感信息多探测器的全流程自动化分析器,深度评估的默认起点 | WebFetch 仓库页:README/徽章/文档链 | 高 |
| 12 | FACT_core | Fraunhofer FKIE | 2017 起 | GitHub / 开源工具 | https://github.com/fkie-cad/FACT_core | Fraunhofer FKIE 的固件分析比较工具(Firmware Analysis and Comparison Tool):Web UI、插件化分析、可对比两版本差异 | WebFetch 仓库页(FKIE 组织);fkie-cad.de 文档交叉 | 高 |
| 13 | esptool | Espressif Systems | 2014 起 | GitHub / 开源工具 | https://github.com/espressif/esptool | Espressif 官方烧录/读取工具:进 ROM 下载模式后 read_flash 直接整片读取(加密未启用时),ESP 全系的固件提取第一工具;配合 flash_encryption 文档理解何时读出来仍是明文 | WebFetch 仓库页;docs.espressif.com 交叉 | 高 |
| 14 | mtkclient | B. Kerler(bkerler) | 2020 起 | GitHub / 开源工具 | https://github.com/bkerler/mtkclient | 联发科 BROM/preloader 攻击工具箱:绕过 DA 认证读写 flash、解锁 bootloader,把 amonet/kamakiri 时代的 bootROM 漏洞链工程化为通用工具,MTK 设备取证事实标准 | WebFetch 仓库页(README 自述支持芯片族);XDA 讨论交叉 | 高 |
| 15 | amonet | chaosmaster11 | 2018-2019 | GitHub / 开源利用 | https://github.com/chaosmaster11/amonet | MediaTek MT81xx bootROM 漏洞利用链(早先针对 Fire 平板等设备):BROM 阶段注入,获取 flash 读写;bootROM 攻击"随芯片终身有效"的代表 | WebFetch 仓库页(README 芯片范围);作者仓库系列交叉 | 高 |
| 16 | kamakiri | chaosmaster11 | 2019 | GitHub / 开源利用 | https://github.com/chaosmaster11/kamakiri | MediaTek MT67xx 系列 bootROM 提权利用(利用 preloader 阶段缺陷),与 amonet 构成 MTK bootROM 攻击的两个世代 | WebFetch 仓库页 | 高 |
| 17 | sasquatch | ReFirmLabs/devttys0 | 持续维护 | GitHub / 开源工具 | https://github.com/devttys0/sasquatch | 打过补丁的 unsquashfs:binwalk 提取嵌入式设备常见的非标准 squashfs(异端 magic/压缩格式)必备 | WebFetch 仓库页;binwalk wiki 交叉 | 高 |
| 18 | jefferson(JFFS2 提取器) | 社区(主仓归属未核) | 持续维护 | GitHub / 开源工具 | (主仓 URL 未核, 见验证证据) | JFFS2 文件系统提取器,与 sasquatch/ubi_reader 并列的提取三件套 | 工具角色经 binwalk 配套文档确认;主仓归属未核实——使用前在 GitHub 检索 "jefferson jffs2" 确认主仓 | 中 |
| 19 | ubi_reader | jrspruitt | 持续维护 | GitHub / 开源工具 | https://github.com/jrspruitt/ubi_reader | UBI/UBIFS 镜像提取(路由器/IoT 常见 NAND 布局),NAND 设备解包必备 | WebFetch 仓库页;PyPI 交叉 | 高 |
| 20 | STM32CubeProgrammer | STMicroelectronics | 持续维护 | 官方工具 | https://www.st.com/en/development-tools/stm32cubeprog.html | ST 官方编程器:AN3155/AN3156 等协议的主机端实现,含 OBP/密钥编程与安全状态查看,理解官方"合法读法"以对照攻击面 | ST 官网产品页实访 | 高 |
| 21 | The Hardware Hacking Handbook 第 6-9 章(固件与存储) | van Woudenberg & O'Flynn | 2021 | 书籍章节 | 见 01 域清单 #25 | 存储器层级、SPI flash 提取实操、解包流程的系统化教材版(与 01 域共享条目,此处列方法学章节) | 同 01 域(No Starch 官网+书评多源) | 高 |
| 22 | Practical IoT Hacking(固件章节) | 多作者 | 2021 | 书籍 | (出版细节未核, 见验证证据) | IoT 攻击全景书中的固件提取/分析章节,中文社区常作教材;出版信息待复核后引用 | 该书存在性与主题经检索确认;作者/出版社/年份未能核实,引用前需复核 | 中 |

## 工具与资源速查

(star 数为 2026-09-30 GitHub API 快照;仅列本域核心,调试口类工具见 01 域)

| 名称 | 用途 | 验证情况 |
|------|------|----------|
| binwalk | 签名扫描/递归提取/熵分析 | 仓库实访(star 快照以 GitHub 为准) |
| unblob | 现代化提取器,可审计 | 仓库实访 |
| EMBA | 全流程固件安全分析 | 仓库实访 |
| FACT_core | 插件化分析与版本对比 | 仓库实访 |
| esptool | ESP 固件读写 | 仓库实访 |
| mtkclient | MTK BROM 攻击 | 仓库实访 |
| flashrom | SPI/并口 flash 读写 | 见 01 域 |
| stm32flash | AN3155 的开源主机实现 | 仓库检索核对(作者 geoffray? ) |
| firmadyne | 全系统仿真+动态分析 | 仓库实访(star 快照以 GitHub 为准) |
| firmwalker | 敏感信息速查(密码/密钥/证书) | 仓库检索核对 |
| Ghidra | 解包后逆向(NSA 开源) | github.com/NationalSecurityAgency/ghidra,广为人知 |

## 入门路径

1. **概念建立**:OWASP FSTM(#7)通读,建立"获取→分析→验证"流程观;《The Hardware Hacking Handbook》固件章节建立存储器层级概念。
2. **第一次提取(软件层)**:随便找一个路由器固件升级包,binwalk -e 解开,sasquatch 处理 squashfs,firmwalker 扫敏感信息——零硬件完成第一次固件分析。
3. **第一次硬件提取**:STM32 Nucleo/Blue Pill 板,按 AN2606 进 boot,用 USB-TTL + stm32flash(或 CubeProgrammer)按 AN3155 走一遍 Get/Read Memory;本项目 `reproductions/stm32_bootloader.js` 先在协议级演练一遍再上真板。
4. **SPI flash 实操**:旧路由器 + SOIC8 夹具/脱焊 + flashrom;配合 01 域 VoidStar 教程。
5. **大规模视角**:精读 Costin'14(#4)→ Avatar(#6)→ firmadyne(#5),配 firmadyne README 跑一次仿真(有 Ubuntu 环境时)。
6. **平台深化**:ESP 系(esptool + flash_encryption 文档)→ MTK 系(mtkclient README + amonet/kamakiri 写作背景)。
7. **流程化**:把上述拼成 EMBA/FACT 一条龙,对照 FSTM 做一次完整设备评估。
8. **安全自查**:读 CVE-2022-4510,理解"分析不可信固件要隔离",建立自己的解包卫生习惯。

## 纠错与存疑(引用本域资源前必读)

**已核实的常见误引:**

1. **Costin et al. 2014 作者**:四人 Aurélien Costin、Jonas Zaddach、Aurélien Francillon、Davide Balzarotti(Eurecom/Sophia),USENIX Security 2014——常见漏掉 Zaddach 或误作 EuroSys。
2. **firmadyne 论文与工具分开引**:论文(NDS'16, Chen/Woo/Brumley/Egele)与工具仓库(firmadyne/firmadyne)是两个实体;"Firmadyne 出自 CMU"的说法正确(前三位 CMU,Egele 时在 UCSB/后 BU)。FirmAE 为后续改进,但本调研未能核实其准确题录与主仓,提及需谨慎。
3. **amonet 与 kamakiri 的分工**:同为 chaosmaster11 的 MediaTek bootROM 利用链,常见混为一谈;按 README,两者针对不同世代/系列的 MTK 芯片(MT81xx vs MT67xx 一带),精确芯片覆盖以仓库自述为准。
4. **AN3155 版本注意**:AN3155 长期修订(Rev.13 左右),命令集随家族扩展(如 Extended Erase 0x44 较晚加入);引用具体命令字节时应注明芯片家族与笔记版本——不同家族(如 F1 与 L4)的 boot 命令有差异。

**存疑条目(引用需谨慎):**

5. **CVE-2022-4510 的精确受影响版本**:漏洞存在性与主题(路径穿越)经 NVD 确认;具体受影响版本区间与修复版本号在本次调研中未能完全钉死,引用时以 NVD/GHSA 页为准。
6. **jefferson(JFFS2 提取器)主仓与作者**:工具角色确定(binwalk 生态引用),但主仓归属未核实,18 号条目的 URL 不完整——使用前在 GitHub 检索确认。
7. **Practical IoT Hacking 出版信息**:书的存在与主题经检索确认,作者名单/出版社/年份未核实,引用前需复核(常被引作 No Starch 2021,未验证)。
8. **"EMBA 由 Fraunhofer 主导"的说法**:EMBA 与 FACT 分属不同社区(e-m-b-a vs fkie-cad),偶见混引;EMBA 的发起者归属未完全核实。
9. **stm32flash 作者**:工具存在性经交叉确认,作者(GitHub handle)未核实。
