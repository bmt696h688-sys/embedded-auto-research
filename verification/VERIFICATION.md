# 真实性验证报告(VERIFICATION)

> 本文件是整个知识库的验证契约:说明"已验证"意味着什么、如何验证、验证到什么程度、以及哪些内容尚未验证。验证执行日:2026-09-30。

## 一、四层验证体系(与姊妹项目 side-channel-research 同构)

| 层级 | 对象 | 方法 | 覆盖范围 |
|---|---|---|---|
| L1 来源级 | 每条外部资源 | 调研 agent 联网实访至少一个权威 URL(ST/Espressif/Raspberry Pi 官方文档、USENIX/IACR/IEEE/ACM 会议页、NVD、GitHub API/仓库页、厂商官网),确认资源存在且标题/作者/年份/出处一致 | 知识库全部 112 个编号条目 |
| L2 交叉级 | 高价值条目 | 第二个独立来源交叉核对(如 USENIX 议程页+arXiv;NVD+厂商公告;官网+媒体报道) | 大部分"高"置信度条目 |
| L3 内容锚定 | 协议组件 | 官方规范常量的已知答案测试:IEEE 1149.1 状态转移表/IDCODE 布局/BYPASS 语义;AN3155 校验规则(取反/XOR)与 ACK/NACK;ISO-TP SF/FF/CF 布局;UDS SID+0x40 与 NRC 常量;ISO 11898 TEC 规则 | 全部 3 个复现实验 |
| L4 复现级 | 方法学主张 | 可重跑实验验证文献方法机理(确定性输出,结果逐位可复现) | TAP 枚举/自举协议/RDP 门禁/仲裁/bus-off/UDS 攻击场景等 6 组 54 项断言 |

## 二、执行统计与环境

- 6 个调研 agent 并行执行(01 调试接口/02 固件提取/03 IoT-SoC 案例/04 总线/05 ECU-车机/06 工具-标准-社区),搜索通道为已批准的默认方案 v1:Parallel MCP web 搜索 + 学术/标准 API + GitHub API + HN/StackExchange + WebFetch 实访。
- **环境发现(重要情报)**:Parallel 免 key MCP 的免费额度有限——本批调研中单 agent 约 **9-10 次搜索后触顶**;后续大规模调研应按"每 agent 配额 ≤8 次搜索、超限即降级到学术 API+GitHub+HN 组合"规划。Exa 语义层待用户提供 key 后启用。
- 知识库合计 **112 个编号条目**(01:25 / 02:22 / 03:18 / 04:23 / 05:24)+ 06 域横向表(工具约 28 项、标准 10 项、社区 10 项)。
- 置信度分布:高 ≈ 78 条;中 ≈ 29 条(多为"题录高/细节 URL 或作者未核");**未验证已隔离 4 条**(见第五节);另有 06 域价格/star 等时效性数据标注"以官方为准"。

## 三、诚实声明:落盘损耗(本项目特有的边界)

与姊妹项目不同,本项目的调研产出经历了"agent 并行调研 → 主会话汇总落盘"两阶段。**落盘阶段对个别条目的元数据还原存在损耗**:少数条目的精确 URL、完整作者名单、卷期页码无法从调研记录中完整恢复。处理纪律:

1. 凡无法确证的元数据,一律降级为 **[中]** 并在条目内标注"(未核)/(题录待复核)/引用前复核",绝不冒充"高"。
2. 完全无法恢复一手来源的条目,标注 **[未验证(已隔离)]** 并移入存疑小节。
3. 代表性损耗条目:Google Nest Wifi Pro 提权链(03 域)、Rogers 2022 bus-off 改进(04 域)、CANdid 与 Beneath the Bonnet 的完整题录(05 域)、2025 汽车安全 SoK(05 域)。**引用前必须按各域提示检索复核。**

## 四、代表性纠错(引用本领域文献前必读)

完整清单见各域 README"纠错与存疑"小节(合计 24 处已核实误引)。最重要的几条:

- **Koscher et al. 2010** 正式出处为 **IEEE S&P 2010**(非 USENIX)——本领域最高频误引
- **Miller & Valasek**:2014=白皮书+物理接入(Prius/Escape),2015=S&P+远程 Jeep;"2014 年黑了 Jeep"双重错误
- **bus-off 攻击原始论文**:Cho & Shin, "Error Handling of In-Vehicle Networks Makes Them Vulnerable", **CCS 2016**(题名混传为 "Adversarial Switching Attacks" 是错的)
- **Pwn2Own Automotive 官方数字**:2024=49 0day/$1,323,750;2025=49/$886,250;2026=76/$1,047,000(ZDI 官方博客实访核对)
- **picopwner**:2023-05 发布(非 2024);实现的是 WOOT'20(F1)攻击而非 WOOT'17(F0)
- **"ESP32 后门"(2025)的重新定性**:Tarlogic 发现的是未公开厂商调试 HCI 命令,非出厂后门,利用前提苛刻
- **KeeLoq 攻击谱系四篇递进**(Bogdanov RFIDSec'07 → Courtois/Bard/Wagner FSE'08 → Indesteege EUROCRYPT'08 → Eisenbarth CRYPTO'08),不存在"一篇论文破 KeeLoq"
- **Tesla 钥匙是两篇论文**:TCHES 2019(DST80/Model S)与 TCHES 2021(PKES/Model 3),作者 Wouters 与 Starlink 研究同人但属不同工作
- **RP2040 无安全启动**——与 RP2350(OTP/secure boot/毛刺检测器)的安全前提完全不同,案例不可互换
- **SECGlitcher Part 1 打的是 RDP1**(RDP2 降级是 Part 2 预告);APPROTECT 复活是 LimitedResults Part 1(2020-06-10),无 Part 3

## 五、隔离区(未能验证的内容——不得作为事实引用)

- **Google Nest Wi-Fi Pro root→EL3 提权链**(03 域 #9):案例在调研中出现,一手来源在落盘时丢失
- **闲鱼 STM32"固件解密服务"**(03 域 #10):仅社区转述,无权威原始报道
- **2025 汽车安全 SoK**(05 域 #24):仅检索线索,题录全未钉死
- **Rogers 2022 bus-off 静默化改进**(04 域 #9):工作存在性确认,题录/URL 未恢复
- 另有约 26 项 [中] 置信条目散布各域(多为题录可靠但 URL/作者/卷期待复核),已在各条目内就地标注

## 六、诚实的边界声明

1. **验证的是"来源真实性与元数据一致性",不是内容的正确性**;内容正确性靠同行评审版本优先引用 + L3/L4 复现逼近。
2. **协议仿真的边界**:3 个实验为协议级仿真(无位填充/ACK 时序/毛刺电路等硬件效应),机理与真实机制同构但参数不可直接外推;STM32 地址建模采用自举别名窗口(代码内注释)。
3. **时效性**:验证结论截至 2026-09-30;GitHub star/价格快照、RP2350 ROM 修订状态、Pwn2Own 后续届次等会自然过时,建议每季度复验关键条目。
4. **搜索通道局限**:Parallel MCP 免费额度小(见第二节),本批调研后期部分依赖学术 API 与 GitHub;dblp/Wikipedia/archive.org 在本环境不可达(与姊妹项目相同)。

## 七、复验方法

- 任何条目: 点击其 URL(优先 DOI/官方域名)人工复核
- 批量复验: 重新派出调研 agent(注意 Parallel 配额,超限降级学术 API+GitHub);或对 DOI/URL 列表脚本化探活
- 复现实验: `cd reproductions && node jtag_tap.js && node stm32_bootloader.js && node can_uds_sim.js`(确定性,54 项断言);全量日志见 `reproductions/experiment_results.txt`
