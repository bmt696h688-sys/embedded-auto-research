# 03 · IoT/SoC 攻击案例库

> 由调研 agent 于 2026-09-30 联网搜集。本域是"案例驱动"的:按 SoC 平台/设备归档代表性攻击,每个案例注明攻击向量与产出;跨域基础(调试口/毛刺/固件提取)引用 01/02 域条目,不重复展开。

## 方法地图

```
IoT/SoC 攻击案例(按平台)
│
├── 1. ESP32 / ESP8266 (Espressif)
│   ├── 毛刺三连: AES 实现(FaultPWN) → secure boot(FBSB) → flash encryption
│   ├── Raelize: crowbar 电压毛刺复现 secure boot 绕过(工程化验证)
│   ├── "隐藏命令"事件(Tarlogic 2025)→ 社区重新定性为厂商调试 HCI 命令
│   └── 防线: flash encryption + secure boot v2 + eFuse 密钥(文档公开)
│
├── 2. Raspberry Pi RP2040 / RP2350
│   ├── RP2040: 无安全启动 → flash 直读即得全部(与调试保护无关)
│   └── RP2350: 官方悬赏攻击挑战 → 多项毛刺攻击成功(Optiglitch、
│       hextree 双毛刺等)→ 官方在后续 boot ROM 修订(E25)修复并复盘
│
├── 3. Nordic nRF52/nRF53
│   └── APPROTECT 上电毛刺复活 SWD(见 01 域 #9/#10)
│
├── 4. STM32 全系
│   ├── RDP1/RDP2 毛刺与竞态(WOOT'17/'20 → picopwner/SECGlitcher, 见 01 域)
│   ├── 闲鱼"解密服务"现象(2025, 中文二手市场)——实验室技术商品化
│   └── 量产克隆/替换芯片安全差异(WOOT'20 主题)
│
├── 5. FPGA (Xilinx/AMD Zynq, iCE40)
│   ├── Zynq 启动链漏洞(CVE-2022-23822 等)
│   └── bitstream 加密与密钥侧信道(01 域侧信道方法迁移)
│
├── 6. 应用终端(案例来源广)
│   ├── Starlink 用户终端: 电压毛刺签名验证 → 自定义代码(Wouters BH'23)
│   ├── Ledger Nano S 硬件钱包(仿真/毛刺, Goodspeed 书案例)
│   ├── DJI 无人机: 固件解密工具链(dji-firmware-tools)
│   └── Google Nest Wi-Fi Pro: root → EL3 提权链(2025 披露)
│
└── 7. 系统化背景
    └── SoK WOOT'24: 689 颗 Cortex-M + 1797 份固件的攻击面统计
```

## 领域综述

如果说 01/02 域讲"方法",本域讲"战例"。Espressif ESP32 是近年最丰富的案例富矿:LimitedResults 用自制毛刺平台先后破 AES 密码实现、绕过 secure boot、攻破 flash encryption,形成"软件防线在电压毛刺面前逐一失守"的完整叙事;Raelize 随后用 crowbar 电路把同类攻击工程化复现;而 2025 年 Tarlogic 披露的"ESP32 隐藏命令"在媒体上被渲染为"芯片后门",经社区与 Espressif 复核重新定性为**未公开的厂商调试 HCI 命令、且攻击需要近距离接触蓝牙链路**——这是"案例传播中的失真"的活教材(见纠错 #3)。Raspberry Pi 则提供了罕见的"官方悬赏"样本:RP2350 发布时公开征集攻击,多项毛刺攻击(含绕过其引以为傲的毛刺检测器的"双毛刺"手法)成功获奖,官方随后在新 ROM 修订中修复并公开复盘——把 normally 黑箱的"芯片厂 vs 攻击者"对抗变成了公开记录。STM32 的故事从 WOOT 论文走向了商品化:从 WOOT'20 的实验室毛刺,到 picopwner 的数美元复现,再到 2025 年中文二手市场上出现按颗收费的"固件解密服务",攻击成本曲线的坍缩一目了然。跨平台看,SoK WOOT'24 对 689 颗 Cortex-M 与 1797 份固件的统计把这些个案收拢成图景:调试口与固件读保护是本地攻击的主战场,而 secure boot/flash encryption 的实现质量参差,是整个生态最系统性的软肋。应用层终端(Starlink 终端、硬件钱包、无人机、智能家居)则是这些平台技术的"下游用户",同样的电压毛刺,打在物联网网关上就是 EL3 提权,打在卫星终端上就是任意代码执行。

## 资源清单

| # | 标题 | 作者 | 年份 | 出处/类型 | URL | 内容与重要性 | 验证证据 | 置信度 |
|---|------|------|------|-----------|-----|--------------|----------|--------|
| 1 | ESP32 攻击三部曲(FaultPWN / FBSB / flash encryption) | LimitedResults | 2019-2020 | limitedresults.com / 博客系列 | https://www.limitedresults.com/results/ | ESP32 安全机制在电压毛刺下的系统性失守:AES 实现(FaultPWN)、secure boot 绕过、flash encryption 破解;与 nRF52 复活系列同作者同平台方法论 | limitedresults.com/results 索引页实访核对系列存在与主题(同 01 域 #9 验证);单篇精确标题/日期未逐一复核 | 高(系列) 中(单篇题录) |
| 2 | Fault Injection Attack on ESP32 | Raelize | 2020 | raelize.com / 安全公告+白皮书 | https://raelize.com/ | 用 crowbar 电压毛刺绕过 ESP32 secure boot 的工程化演示,含可复现参数;将学术毛刺攻击拉到"低预算可做"的水平 | 官网检索核对公告存在;单页 URL 未定,经根域导航 | 高(存在) 中(细节) |
| 3 | ESP32 "隐藏命令"披露(Tarlogic) | Tarlogic Security | 2025-03 | tarlogic.com / 博客披露 | https://www.tarlogic.com/ | 在 ESP32 蓝牙固件中发现未公开厂商调试命令(篡改 MAC/侵入安全模式),媒体初称"芯片后门";经社区复核**重新定性**:非硬件后门,为厂商私有 HCI 命令,利用前提苛刻(近距离 BT 链路),Espressif 已评估 | 披露事件经多源检索核对(Tarlogic 官网+主流媒体报道);CVE 编号未能钉死,以 NVD 检索为准 | 高(事件) 中(CVE 号) |
| 4 | RP2350 官方攻击挑战(公告与结果) | Raspberry Pi Ltd | 2024-2025 | raspberrypi.com / 官方博客 | https://www.raspberrypi.com/news/rp2350-hacking-challenge/ | RP2350 随发布公开悬赏安全攻击:多项毛刺攻击获奖(含 E16/E20/E21/E24 等条目),官方在后续 boot ROM 修订(E25)修复并公开复盘——芯片安全对抗少有的全公开记录 | 官方新闻页检索核对挑战存在与获奖事实;E 编号体系与获奖名单细节以官方结果帖为准 | 高(事件) 中(细节) |
| 5 | RP2350 毛刺检测器绕过(双毛刺) | hextree | 2025 | hextree.io / 技术博客+CTF 教学 | https://hextree.io/ | 用两次精心定时的毛刺绕过 RP2350 的毛刺检测器再攻击安全启动的写法,挑战获奖条目之一;hextree 平台另有 RP2350 攻击系列教学 | 平台与写作经检索核对;单篇 URL 未定 | 高(存在) 中(单篇) |
| 6 | Starlink 用户终端故障注入 | Lennert Wouters(KU Leuven) | 2023 | Black Hat USA 2023 / 会议演讲 | https://www.blackhat.com/us-23/briefings/schedule/ | 电压毛刺打穿 Starlink 终端 SoC 的签名校验,在用户终端上运行任意代码;自制 PCB 毛刺板的完整开源披露(作者即 Tesla 钥匙攻击者) | Black Hat 议程页检索核对讲者与主题;开源硬件经 GitHub 检索印证 | 高(事件) 中(议程 URL) |
| 7 | dji-firmware-tools | o-gs(社区) | 持续维护 | GitHub / 开源工具 | https://github.com/o-gs/dji-firmware-tools | DJI 无人机固件解密/解包工具链:对加密固件镜像的模块抽取与密钥处理,消费级无人机固件研究的事实起点 | 仓库检索核对(README 自述功能);DJI 研究社区引用交叉 | 中 |
| 8 | Zynq 启动链漏洞(CVE-2022-23822) | AMD/Xilinx(披露方未核) | 2022 | NVD / 厂商公告 | https://nvd.nist.gov/vuln/detail/CVE-2022-23822 | Xilinx Zynq 系列安全启动相关漏洞:攻击面在 bootROM/启动链的信任根,影响 bitstream 与镜像保密性 | NVD 条目检索核对编号与目标;攻击前提与影响范围以厂商安全公告为准 | 中 |
| 9 | Google Nest Wi-Fi Pro 提权链(root → EL3) | (研究者未核) | 2025 | 独立披露 / 博客 | (URL 未定, 见验证证据) | 对 Google Nest Wi-Fi Pro 从已 root 的系统进一步提权到 ARM EL3(安全监控层)的完整链条,覆盖物联网网关 SoC 的信任层逐级击穿 | 调研 agent 在搜索中发现该案例记录;汇总落盘时原始 URL 丢失——**引用前必须检索复核**,暂列中低置信 | 未验证(已隔离) |
| 10 | 闲鱼 STM32 "固件解密服务"现象 | 中文社区观察(原文未核) | 2025 | X/微博转述 | (无稳定 URL) | 二手交易平台出现按芯片收费的 STM32 RDP 解密服务,被视为 WOOT'20 类毛刺攻击"商品化"的标志性现象 | 调研 agent 检索到相关讨论记录;无权威原始来源,**引用前需复核** | 未验证(已隔离) |
| 11 | SoK: Where's the "up"?! ...Arm Cortex-M Systems | Xi Tan 等 9 人 | 2024 | USENIX WOOT '24 / SoK | 见 01 域清单 #5 | 本域系统化背景:689 颗芯片+1797 份固件的攻击面与安全机制统计;ESP32/nRF/STM32 等平台案例的方法论上游 | 同 01 域 #5(USENIX 页+arXiv 交叉) | 高 |
| 12 | Microcontroller Exploits 案例章(Ledger Nano S 等) | Travis Goodspeed | 2024 | No Starch Press / 书籍 | 见 01 域清单 #24 | Ledger Nano S 硬件钱包攻击、STM32F217 DFU 逃逸等长篇案例,SoC 攻击的"手术记录"级细节 | 同 01 域 #24(No Starch+O'Reilly 多源) | 高 |
| 13 | nRF52 Debug Resurrection(APPROTECT) | LimitedResults | 2020 | limitedresults.com / 博客 | 见 01 域清单 #9-#10 | nRF52840 APPROTECT 毛刺复活;与 ESP32 三部曲构成作者的平台攻击方法论闭环 | 同 01 域 #9 | 高 |
| 14 | ESP32 flash encryption 与 secure boot v2 官方文档 | Espressif | 持续维护 | docs.espressif.com / 官方文档 | https://docs.espressif.com/projects/esp-idf/en/latest/esp32/security/flash-encryption.html | 攻击对应的"防御面"权威定义:eFuse 密钥、AES-XTS flash encryption、secure boot v2 签名链——评估任何 ESP32 攻击前先读这个 | 官方文档站实访核对章节结构 | 高 |
| 15 | RP2350 数据手册(安全章节) | Raspberry Pi Ltd | 2024-2025 | 官方数据手册 | https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf | RP2350 安全架构权威来源:OTP/secure boot/毛刺检测器(TRNG+双轨监测)设计——挑战案例(#4/#5)的对照面 | datasheets.raspberrypi.com 域名模式与 RP2040 一致,文件存在性经检索印证 | 中(URL 模式推断) |
| 16 | SECGlitcher / Anvil STM32 毛刺 | SEC Consult / Anvil Secure | 2024/2025 | sec-consult.com / anvilsecure.com | 见 01 域清单 #13-#14 | STM32 读保护毛刺的当代工程化复现,案例与 01 域共享 | 同 01 域 #13/#14 | 高 |
| 17 | stm32f1-picopwner | CTXz | 2023 | GitHub / 开源利用 | 见 01 域清单 #22 | RDP1 绕过的平价复现,案例商品化(#10)的技术底座之一 | 同 01 域 #22 | 高 |
| 18 | Stacksmashing / LiveOverflow 平台攻击视频 | Stacksmashing, LiveOverflow | 2021-2025 | YouTube / 视频系列 | https://www.youtube.com/@stacksmashing | RP2350/RP2040、硬件钱包等平台的可视化攻击过程(Stacksmashing 参与过 RP2350 挑战内容);LiveOverflow 的 JTAG/硬件系列适合建立直觉 | 频道存在性与主题经检索核对;单集内容质量不一 | 中 |

## 入门路径

1. **建背景**:先读 01 域方法地图与 SoK WOOT'24(#11)的统计图景,再进案例。
2. **按平台精读一组**:ESP32 三部曲(#1)+ Raelize(#2)+ Espressif 安全文档(#14)——同一平台"攻-防-文档"三面看。
3. **看公开对抗**:RP2350 挑战公告(#4)→ hextree 双毛刺(#5)→ RP2350 手册安全章(#15),体会"厂商设擂-攻者破关-官方修复"的完整周期。
4. **跟踪商品化**:STM32 线:WOOT'20(01 域 #3)→ picopwner(#17)→ 闲鱼现象(#10,注意此条未验证)。
5. **跨平台迁移**:Starlink(#6)、Ledger(Goodspeed 书 #12)、DJI(#7)——看同一套毛刺/提取技术如何落到不同终端。
6. **对着做**:ESP32-DevKit(几十元)+ 移植 picopwner 思路,复现一次 FaultPWN 式毛刺;或从 RP2350 挑战复盘里挑一个已修复漏洞理解根因。
7. **传播学一课**:精读"ESP32 后门"事件的原始披露(#3)与社区复核结论,练习"对二手结论先查一手来源"。

## 纠错与存疑(引用本域案例前必读)

**已核实的常见误述:**

1. **"ESP32 有后门"(2025)的定性错误**:Tarlogic 发现的是**未公开的厂商私有 HCI 调试命令**(可改 MAC、进入安全模式等),不是出厂恶意后门;利用前提是接近目标蓝牙链路,且 Espressif 发布了评估。媒体报道中"十亿设备内建后门"属夸大,引用时必须按重新定性后的结论表述。该事件是否分配 CVE、编号为何,本调研未能钉死,引用前查 NVD。
2. **RP2350 ≠ RP2040 的安全前提**:RP2040 **没有 secure boot、没有 flash 读保护**(flash 在片外,拿到板子=拿到固件),常被误说成"树莓派芯片都带安全启动";RP2350 才引入 OTP/secure boot/毛刺检测器——两个芯片的案例不可互换引用。
3. **Starlink 攻击的归属**:modchip 故障注入攻击是 KU Leuven **Lennert Wouters** 团队(Black Hat 2023);注意与他同名的 Tesla 钥匙研究(TCHES'19/'21)区分——同人不同工作,常被张冠李戴成"特斯拉研究者黑了星链"式的含混表述。
4. **"闲鱼解密"不是新漏洞**:该现象(未验证条目)是 WOOT'20 时代技术的**服务化**,不代表 STM32 新出现系统性弱点;引用该现象时须与 RDP1/RDP2 的技术边界(见 01 域纠错 #12)一起说清。

**存疑与隔离条目(不得作为事实引用):**

5. **Google Nest Wi-Fi Pro root→EL3(#9)**:案例真实存在于调研发现中,但原始 URL 在落盘时丢失,攻击者/会议/细节均待复核——已标注"未验证",引用前必须找到一手来源。
6. **闲鱼 STM32 解密服务(#10)**:仅有社区转述,无权威原始报道,**未验证**。
7. **RP2350 挑战的获奖名单与 E 编号体系**:事件与"多项攻击成功+ROM 修订修复"的结论可信;E16/E20/E21/E24/E25 等具体编号语义与完整名单以官方结果帖为准,本库未逐条核对。
8. **CVE-2022-23822 的细节**:编号与"Xilinx Zynq"目标的关联经检索确认,但受影响组件/攻击前提/评分未细核,引用以 NVD 条目为准。
9. **dji-firmware-tools 的维护状态与作者**:仓库存在性与用途可信,维护活跃度与作者归属未核。
