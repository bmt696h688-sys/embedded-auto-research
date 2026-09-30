# 复现实验(Reproductions)— 方法、结果与迭代记录

> 定位与纪律与姊妹项目 `side-channel-research/reproductions` 相同:零依赖 Node.js、确定性输出、协议常量锚定(KAT)、可重跑审计。**本组实验为协议级仿真,不含真实硬件效应**(毛刺窗口、信号完整性、位填充时序等),其价值是把文献里的攻击机理变成可执行、可断言的代码。

## 实验一览(2026-09-30 全部通过)

| 实验 | 主题 | 对应文献/知识域 | 断言数 | 结果 |
|------|------|----------------|--------|------|
| `jtag_tap.js` | IEEE 1149.1 TAP 16 态状态机、IDCODE 扫描、BYPASS 链长测量 | Rosenfeld & Karri 2010;Portcullis BroadLink 流程(knowledge/01) | 13 | ✅ 13/13 |
| `stm32_bootloader.js` | ST AN3155 UART 自举协议:同步/Get/Read/Write/擦除校验规则、RDP 置位-拒绝-降级自毁、毛刺机理模型 | AN3155;WOOT'17/'20;picopwner(knowledge/01/02) | 17 | ✅ 17/17 |
| `can_uds_sim.js` | CAN 仲裁与 bus-off(TEC 计数)、ISO-TP SF/FF/CF 分帧、UDS 0x10/0x27/0x22 全流程、算法提取/复位重放/功能寻址枚举四类攻击场景 | ISO 11898/15765-2/14229;Cho&Shin CCS'16(knowledge/04/05) | 24 | ✅ 24/24 |

合计 **54 项断言,0 失败**;完整输出见 `experiment_results.txt`。

## 运行方式

```bash
cd reproductions
node jtag_tap.js && node stm32_bootloader.js && node can_uds_sim.js
# 任何断言失败脚本以非零码退出;确定性种子,输出逐位可复现
```

## 每个实验在"复现"什么(诚实边界)

1. **jtag_tap.js** — 复现的是 JTAG 工具(JTAGulator/OpenOCD)赖以工作的协议内核:状态机转移表按标准逐条录入并自检;IDCODE 的 32-bit 布局(version/part/manufacturer/fixed-1)与 BYPASS=全 1、Capture-IR 低 2 位=01 这些**规范级事实**以断言锚定。仿真的是两颗示例器件(4-bit 与 8-bit IR)的链。**不复现**:真实器件的 IR 指令集、边界扫描寄存器、上电默认状态。
2. **stm32_bootloader.js** — 复现 AN3155 的**校验规则与状态流**(命令取反校验、地址 XOR、读计数取反、写数据 XOR、ACK/NACK、RDP 门禁与"降级即擦除"),以及 WOOT'20 类攻击的**机理**(RDP 检查被跳过时数据外泄——Demo 5 是显式标注的"玩具模型",不是电路仿真)。**建模选择(已注释在代码中)**:AN3155 地址为 3 字节,真实 flash 的 32 位地址 0x08000000 经自举模式下的 0x000000 别名窗口访问,仿真直接以 0x000000 为基址。
3. **can_uds_sim.js** — 复现 CAN 的三个**根源性质**(低 ID 仲裁、错误计数器 +8/bus-off 阈值 255、广播无认证)、ISO-TP 的**帧格式常量**、UDS 的**会话/认证/否定响应语义**,以及文献中反复出现的四类攻击场景(算法提取、复位种子重放、功能寻址枚举、选择性 bus-off)。**不复现**:位填充、ACK 时序、error-passive 延迟、响应方向流控等待。

## 攻击场景与文献的对应(can_uds_sim.js Demo 5)

| 场景 | 攻击面 | 对应真实研究 |
|------|--------|--------------|
| A. 未认证读 DID | 协议防线是否成立 | ISO 14229 语义(基线对照) |
| B. 固件逆向恢复 seed-key 算法 | 0x27 的安全=算法保密性 | CANdid(USENIX Sec'24,题录待复核)、历代 UDS 审计共识 |
| C. 复位后种子重复→重放 | 弱 PRNG 种子管理 | 真实车辆 UDS 种子重用类发现(见 knowledge/05 方法地图) |
| D. 功能寻址 0x7DF 广播枚举 | 诊断拓扑发现 | Caring Caribou 的枚举模块思路 |
| (Demo 2) 选择性 bus-off | CAN 错误处理机制 | Cho & Shin, CCS 2016(knowledge/04 #6) |

## 迭代记录(如实保留失败过程)

1. **jtag_tap.js 首版三处逻辑错误**:(a) RTI→Shift-IR 的导航序列误写为 `[1,0,0,0]`(正确 `[1,1,0,0]`,需经 Select-IR);(b) Exit1→RTI 的返回序列误写为 `[0,0]`(会停在 Pause 态,Update 永不触发,正确 `[1,0]`);(c) BYPASS 标记位传播时序少算一拍(N 位链上,注入位于第 1 拍、在第 N+1 拍被采样)。首版还因直接把状态设为 Shift 态触发 `_drChain` 未初始化崩溃。全部修正后 13/13。
2. **stm32_bootloader.js 首版核心建模错误**:地址字段按 0x08000000 组包,而 AN3155 地址是 3 字节(24 位),高位被截断导致偏移为负、读回全为占位字节(0xEE)。改为别名窗口 0x000000 建模(与 stm32flash 等主机工具行为一致,注释说明)后修复;同时修正 GetID 帧长度断言(5 字节)与固件头断言的下标。
3. **can_uds_sim.js 首版两处错误**:KAT 块引用了尚未定义的 `NRC` 常量(const 不提升,运行即 ReferenceError)——移到定义之后;种子响应行的展开语法少一个闭括号(语法错误)。

这些失败与修复均保留在本节,作为"复现=写出来并跑通过"而非"抄个能跑的"的证据。

## 硬件升级路径(从仿真到实物)

1. **JTAG**:STM32 Nucleo/任一留有 JTAG/SWD 的开发板 + ST-Link/OpenOCD,对照 `jtag_tap.js` 的状态机走一遍 halt→`dump_image`(knowledge/01 入门路径第 4 步)。
2. **AN3155**:USB-TTL(几元)+ 杜邦线,按 AN2606 进自举模式,用 stm32flash(或照本实验手写脚本)对 Blue Pill 之类的板子走 Get/Read;RDP 实验务必在**可牺牲的板子**上做(置位会擦片)。
3. **CAN/UDS**:USB-CAN(CANtact/PCAN)+ ICSim 练习注入;有自有旧车/台架再对真实 UDS 做被动监听→功能寻址枚举(严格只读与授权环境,knowledge/06 纪律节)。
4. 毛刺类(WOOT'20 复现)硬件门槛见 knowledge/06 预算分层;入门路线经 ChipWhisperer(SCA 姊妹项目 `side-channel-research/`)。
