# 路线图(ROADMAP)— 嵌入式/IoT/汽车硬件攻击研究

> 第一阶段(2026-09-30)已完成:6 域知识库 + 3 复现实验(54/54)+ 10 技能。本文件规划后续批次,与硬件攻击总纲(SCA→FI→嵌入式/汽车)对齐。

## 待用户确认的下一步

1. **FI(故障注入)专项调研** —— 总纲中与 SCA/嵌入式并列的第三块,尚未启动。计划:按本项目的六域结构做 FI 版(毛刺物理学/crowbar 与 EMFI/激光/芯片级对策/工具与靶板),完成后与 `emb-readout-protection`、`sca-*` 系列互相引用成网。**启动需用户确认**(遵守 plan-first 纪律)。
2. **Exa 语义搜索接入** —— 用户提供 API key 后:key 存工作区独立文件(不写记忆),实测后纳入默认搜索方案 v1 的语义层;重点用于"案例检索"类任务(03 域这类"按平台找先例"最受益)。

## 第二批:知识库扩充(建议优先级)

| 事项 | 内容 | 备注 |
|---|---|---|
| 隔离区清偿 | 对 4 条未验证条目做定向检索(Nest Wifi Pro 提权链/闲鱼解密/Rogers bus-off/SoK 2025),恢复一手来源或删除 | 偿还 VERIFICATION 第三节的"落盘损耗"债 |
| CAN-FD 专域 | 64 字节帧/双相位采样/兼容期混合拓扑的安全研究 | 04 域存疑 #8 遗留 |
| 车载以太网专域 | 100BASE-T1/SOME/IP/DoIP 攻击面,补 CSUR 2024 综述题录 | 04 域 #16 遗留 |
| J1939 重载车辆 | ESORICS'18 线索展开:Fleet/农业机械/工程机械攻击面 | 05 域边缘 |
| 硬件信任根 | TPM/secure element/OTP 密钥管理在上述平台的状态 | 防御侧纵深 |
| 中文社区源 | 看雪/先知/吾爱的硬件攻击高质量文章收录(经百度/IAB 通道) | 默认搜索方案 v1 的中文支线 |

## 第二批:复现实验(Node.js,零依赖路线)

1. `keeloq_analysis.js` —— KeeLoq 分组密码实现 + 滑动攻击演示(非线性反馈移位寄存器结构简单,适合纯软件复现;与 Eisenbarth 功耗攻击衔接 sca-cpa-attack)
2. `isotp_flowcontrol.js` —— ISO-TP 流控/块大小/STmin 状态机 + 畸形帧攻击(N_FS 超时、序列号跳变)
3. `dbc_reverse.js` —— CAN 报文信号逆向的统计方法(频率/差分聚类),对着 ICSim 录制数据跑
4. `esp32_flash_encryption.js` —— AES-XTS flash encryption 与 eFuse 密钥管理模型(密钥不可读 vs 固件可读的对抗)
5. (可选,进阶) `hitag2_cipher.js` —— Hitag2 流密码实现 + 已知攻击复杂度分析

## 第二批:技能扩充(目标 20+)

- `emb-glitch-fundamentals`(毛刺入门:电压/时钟/EM/激光四路)—— 若 FI 专项先完成则并入其技能组
- `emb-emmc-ufs`(大容量存储提取与 RPMB)
- `emb-trustzone-m`(ARM TrustZone-M 隔离模型与攻击面)
- `auto-iso-tp`(ISO-TP 专项,从 auto-uds-diagnostics 拆分)
- `auto-ota-update`(OTA/刷写链安全,R156 语境)
- `auto-j1939`(重载车辆)
- `emb-supply-chain`(克隆/替换芯片检测,WOOT'20 延伸)
- `emb-hardware-forensics`(二手设备数据残留,Giese 路线)

## 硬件复现路线(需要采购,按 knowledge/06 分层)

| 里程碑 | 装备 | 验证什么 |
|---|---|---|
| M1: AN3155 上真板 | USB-TTL + Blue Pill/Nucleo(约 ¥50) | stm32_bootloader.js 全流程实车复现(Get/Read/RDP NACK) |
| M2: SPI 直读 | SOIC8 夹具 + 旧路由器 | flashrom 提取 + binwalk 解包全链 |
| M3: JTAG/SWD | ST-Link + 留调试口的板子 | OpenOCD halt→dump;对照 jtag_tap.js |
| M4: CAN 注入 | CANtact/PCAN + ICSim | 信号逆向→注入闭环;有台架再上实车(授权) |
| M5: 毛刺入门 | RP2040(picopwner 复现,约 ¥20,可牺牲板) | WOOT'20 RDP1 绕过实测,报告命中率 |
| M6: ChipWhisperer | CW-Lite(衔接 side-channel-research) | 毛刺参数化扫描,衔接 SCA |

与用户嵌入式学习线(普中 A3 + 51 仿真器)的衔接:A3 的 STC8/51 无上述保护机制,适合练 M1-M3 的操作流;小米音箱/Open-XiaoAI 线在刷机成功后可作为 02 域(固件提取/分析)的真实练手对象(自购设备,合规)。

## 维护节奏

- **季度复验**: 关键条目 URL 探活 + Pwn2Own/新 CVE 跟进 + RP2350 修复状态更新
- **新增内容必须走四层验证**(见 verification/VERIFICATION.md),未验证只能进隔离区
- **引用纪律**: 任何下游产出(报告/技能/会话回答)引用本库资源前,查该域"纠错"小节
