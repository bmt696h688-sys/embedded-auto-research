---
name: auto-can-attack
description: "CAN 总线攻击:报文注入(伪装 ECU 发控制报文)、信号逆向(DBC/ICSim)、泛洪与仲裁饥饿 DoS、bus-off 攻击(Cho&Shin CCS 2016 错误计数器武器化)、隐蔽选择性 DoS、ECU 时序指纹入侵检测与对抗、SecOC/CANsec 防御对照、Tindell 2023 CAN injection 盗车手法。适用于授权渗透测试中的车辆网络评估、IDS 研究与防御验证。不适用于 UDS 诊断服务层(auto-uds-diagnostics)、远程攻击面(auto-ecu-ivi)或未授权的实车实验(法律红线)。关键词: CAN bus, CAN 注入, bus-off, 错误计数器, arbitration, ICSim, can-utils, python-can, SecOC, CANsec, ECU fingerprint, Viden, 车载网络, OBD-II。"
---

# CAN 总线攻击

## 适用场景与不适用场景

**适用**:
- 已获授权的实车/台架/仿真环境,评估车内网络: 侦察→注入→DoS→检测
- 研究或验证 CAN IDS(指纹/异常检测)的对抗鲁棒性
- 分析盗车类现实攻击(Tindell CAN injection)的机理与取证

**不适用**:
- 诊断协议层攻击(0x27/0x22 等)→ `auto-uds-diagnostics`
- 远程进入路径(Telematics/API)→ `auto-ecu-ivi`
- **任何未授权的实车主动实验**——公共道路上注入在任何司法辖区都可能构成犯罪

## 根源性质(为什么 CAN 天生可攻击)

1. **无认证无加密**: 报文只认 ID 不认发送者;总线广播,接上就能听全车。
2. **ID 优先级仲裁**: 数值小的 ID 赢——持续发 0x000 可让全部正常报文饿死(泛洪 DoS)。
3. **错误计数器机制**: 每次错误发送方 TEC+8,超 255 即 bus-off 被驱逐——**机制本身可被武器化**(bus-off 攻击)。

## 方法学步骤

1. **协议机理打底**: 跑 `embedded-auto-research/reproductions/can_uds_sim.js`(仲裁/bus-off/ISO-TP/注入场景仿真,24 项断言);读 ISO 11898 的仲裁与错误处理章节。
2. **无硬件练手**: ICSim(仪表盘模拟器)+ can-utils: `candump` 观察信号→ 操作开关再观察 diff → 定位控制报文 → `cansend` 复现仪表动作(信号逆向最小闭环)。
3. **实车/台架被动侦察**(只听不发): OBD 口接 USB-CAN(CANtact/PCAN)→ `candump -l` 长时录制;点火/开关门/转向各状态做 diff,建立信号地图(车 != 台架时注意高速/动力 CAN 与 body CAN 常是不同总线,经网关隔离)。
4. **注入实验**(授权封闭环境): 从 body 域低风险信号起步(车窗/灯光);理解网关白名单——跨域注入常被 GW 过滤,现代攻击走"低防护分支"(大灯/雨刮的 CAN 直达 body ECU,Tindell 2023 手法)。
5. **DoS 实验**: 泛洪(高优先级 ID 灌包)观察总线占用;bus-off 攻击对目标 ECU 定向驱逐(can_uds_sim.js Demo 2 的 TEC+8×32 模型;真实实现要求精确破坏特定 ID 的报文使目标独享错误)。
6. **检测与对抗**(防御视角): ECU 时序/电压指纹(Cho & Shin USENIX'16)检测"ID 非原发";对抗手段: 慢速注入/时序模仿——评估 IDS 时两个方向都测。
7. **防御对照**: SecOC(MAC+freshness,量产主线,注意密钥管理与计数器同步的现实难点)挡注入不挡 bus-off;CANsec(链路层, eprint 2025/2224)与车载以太网是新方向。

## 关键细节与常见坑

- **Koscher'10 是 IEEE S&P 不是 USENIX**(本域最高频误引);Checkoway'11 才是 USENIX——四车/十人作者。
- **M&V 2014 vs 2015**: 2014=白皮书+物理接入(Prius/Escape),2015=S&P 论文+远程未改装 Jeep;混引时间线/车型是常见错误。
- **bus-off 原始论文**是 Cho & Shin 的 "Error Handling of In-Vehicle Networks Makes Them Vulnerable"(CCS 2016)——别用流传的别名。
- 注入前确认目标总线与网关拓扑: 对动力域 CAN 直接注入在很多现代车上已不可达(网关分段),盲目试会浪费时间并触发 DTC/安全机制。
- 每次实验后清除 DTC 并记录(车辆状态恢复是授权测试的义务)。
- CAN-FD(64 字节帧)与经典 CAN 混合网络的攻击面差异: 领域常识,专门文献本库未收录(knowledge/04 存疑 #8),引用前自行补证。

## 参考实现与工具

- `embedded-auto-research/reproductions/can_uds_sim.js`——仲裁/bus-off/ISO-TP/注入全仿真
- can-utils(linux-can)/ python-can(hardbyte)/ SavvyCAN/ ICSim(zombieCraig)/ Caring Caribou/ CANtact(Linklayer)——knowledge/04 工具表(仓库实访)
- canislabs.com(Ken Tindell 博客)——CAN injection 检测/防御的持续输出

## 已验证参考文献(引用前查 knowledge/04 纠错节)

- Koscher 等, "Experimental Security Analysis of a Modern Automobile", IEEE S&P 2010 [高]
- Checkoway 等, "Comprehensive Experimental Analyses of Automotive Attack Surfaces", USENIX Security 2011 [高]
- Miller & Valasek, 2014 白皮书(Adventures in Automotive Networks)与 2015 S&P(Jeep 远程) [高]
- Cho & Shin, "Error Handling of In-Vehicle Networks Makes Them Vulnerable", CCS 2016(bus-off) [高]
- Cho & Shin, "Fingerprinting Electronic Control Units for Vehicle Intrusion Detection", USENIX Security 2016 [高]
- Palanca, Even, Marchetti, IDAACS 2017(隐蔽选择性链路层 DoS) [高(条目)/卷期中]
- Tindell, "CAN Injection: Keyless Vehicle Theft", canislabs.com, 2023 [高]
- AUTOSAR SecOC / CANsec(eprint 2025/2224) [高/中]
