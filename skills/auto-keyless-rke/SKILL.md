---
name: auto-keyless-rke
description: "无钥匙进入与启动系统攻击:RKE 滚码(KeeLoq 攻击谱系——Bogdanov 滑动/Courtois 代数/Indesteege 实用侦听/Eisenbarth 功耗完整破)、应答器 Hitag2(Gone in 360 Seconds)、PKES 中继攻击、Tesla 钥匙(Wouters TCHES 2019 DST80/2021 Model 3 PKES)、RollJam 记录-阻塞-重放、Proxmark 工具链。适用于车钥匙安全评估、中继攻击防御研究、授权渗透测试。不适用于 UDS 诊断(auto-uds-diagnostics)或整车远程路径(auto-ecu-ivi)。关键词: keyless entry, PKES, RKE, rolling code, KeeLoq, Hitag2, DST80, relay attack, 中继攻击, RollJam, Tesla key fob, Proxmark, 车钥匙, 滚码。"
---

# 无钥匙进入与启动(RKE/PKES)

## 适用场景与不适用场景

**适用**:
- 授权评估车辆钥匙系统: 滚码强度、PKES 抗中继、钥匙固件提取
- 防御研究: 中继攻击的检测(UWB 测距/时间戳)与滚码体系升级
- 取证/保险语境下的盗车手法分析

**不适用**:
- 对他人车辆实施任何钥匙攻击=盗窃工具行为,无论"研究"名义——只对自有车辆/实验钥匙做
- 远程/云端路径 → `auto-ecu-ivi`

## 系统类型与攻击矩阵

| 系统 | 机制 | 代表攻击 |
|---|---|---|
| 固定码 RKE | 无变化 | 直接重放(教科书级) |
| 滚码 KeeLoq | 计数器+KeeLoq 分组密码 | 滑动/代数/功耗攻击谱系(2007-08 全面沦陷)+ RollJam(信号层) |
| 应答器 Hitag2 | 挑战-响应 | 侦听+密码分析(Gone in 360 Seconds, USENIX'12) |
| PKES(被动无钥匙) | 钥匙感应低频唤醒 + RF 双向 | **中继攻击**(距离不设防,Wouters TCHES'21) |
| Tesla Model S(DST80) | 应答器 | 快速密钥恢复(Wouters TCHES'19) |

## 方法学步骤

1. **识别系统**: 钥匙类型(RKE 按钮/PKES 感应)、年份、芯片(KeeLoq 家族/Hitag2/DST80/厂商私有);拆钥匙看芯片丝印(自有钥匙)。
2. **信号侦察**(授权环境): SDR(hackrf/rtl-sdr)+ Proxmark3 记录钥匙 RF 交互: 载波频率(315/433/868 MHz)、调制、帧结构。
3. **滚码分析**: 按压序列采帧——计数器递增规律、固定码部分(序列号)、 hopping 部分;KeeLoq 场景评估: 密钥恢复类攻击(需要大量报文+计算)vs RollJam 类信号层攻击(需要 jam 能力,且只对无双重防重放设计有效)。
4. **PKES 中继评估**: 两个中继节点(车旁收 LF/钥匙旁重放)——"钥匙在兜里,车被开走";Wouters 的超跑 PKES 论文是方法论模板;**防御侧**测试 UWB 测距/相位测距是否部署及精度。
5. **应答器(防盗 immobilizer)分析**: 诊断口/读写器采集挑战响应对;Hitag2 的密码分析路线(Gone in 360 Seconds)评估可行性;DST80 类看是否有公开密钥恢复研究可循。
6. **工具链**: Proxmark3(Hitag2/KeeLoq 支持生态)+ SDR + 自制 LF 天线;钥匙侧固件提取(emb-firmware-extraction, 有些钥匙是 MCU+RF 芯片)。
7. **报告**: 按系统分层给结论——密码层(算法强度)/协议层(防重放设计)/物理层(中继),并给对应的现实防御(滚动至 AES+CMAC、PKES 加 UWB、睡眠唤醒策略)。

## 关键细节与常见坑

- **KeeLoq 谱系四篇是递进关系别混引**(knowledge/05 纠错 #3): Bogdanov(RFIDSec'07 滑动)→ Courtois/Bard/Wagner(FSE'08 代数/SAT)→ Indesteege 等(EUROCRYPT'08 实用侦听)→ Eisenbarth 等(CRYPTO'08 功耗完整破)。
- **RollJam 是概念攻击**(Kamkar 2015): 对"缺乏双重防重放设计"的跳码系统构成威胁;不是"所有滚码系统都能被开走"。
- **中继至今没有便宜的根治方案**: UWB 测距是当前主线;评估报告别写"已修复",写"检测概率提升"。
- **Tesla 两篇论文别合并**: TCHES 2019(DST80, Model S 钥匙)与 TCHES 2021(PKES, Model 3/超跑)目标与作者数都不同;Wouters 同人还有 Starlink 研究(03 域)。
- 316/433 MHz 频段法规: 发射功率/占用时间受各地无线电管理约束——SDR 发射实验注意合规(即便"只对自己的车")。
- 拆解钥匙可能物理损毁(墨水/易碎封装),备份钥匙先。

## 参考实现与工具

- `embedded-auto-research/reproductions/can_uds_sim.js` 的 PRNG/重放场景——"复位后种子重复→重放"与滚码防重放失效同构(机理层)
- Proxmark3 / hackrf / rtl-sdr——RF 侧标准工具
- 侧信道衔接: Eisenbarth CRYPTO'08 是功耗分析(方法在姊妹库 sca-cpa-attack)

## 已验证参考文献(引用前查 knowledge/05 纠错节)

- Verdult, Garcia, Balasch, "Gone in 360 Seconds: Hijacking with HiTag2", USENIX Security 2012 [高]
- Wouters, Gierlichs, Piessens, "Dismantling DST80", TCHES 2019(2) [高(题录)/URL 中]
- Wouters 等, "Fast, Furious and Insecure", TCHES 2021(3)——PKES/中继 [高(题录)/URL 中]
- Kamkar, RollJam, 2015(samy.pl) [高]
- KeeLoq 四部曲(见上) [高(题录)]
- Hitag2 后续深化(2016/2017)——题录未完全钉死, 引用前复核 [中]
