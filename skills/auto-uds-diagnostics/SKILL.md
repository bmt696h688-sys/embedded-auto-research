---
name: auto-uds-diagnostics
description: "UDS(ISO 14229)诊断协议攻击:会话控制 0x10 状态机缺陷、SecurityAccess 0x27 seed-key 弱点(弱 PRNG/复位种子重放/算法固件提取)、读写 DID 0x22/0x2E 敏感数据、刷写 0x34-0x37 任意代码植入面、功能寻址 0x7DF 枚举、NRC 语义分析、python-udsoncan/Caring Caribou 工具链。适用于授权车辆/ECU 渗透测试、ECU 安全审计、诊断协议安全研究。不适用于 CAN 链路层攻击(auto-can-attack)或无钥匙系统(auto-keyless-rke)。关键词: UDS, ISO 14229, SecurityAccess, seed-key, 0x27, 0x10, 0x22, DID, NRC, OBD, 诊断口, python-udsoncan, ECU hacking, 刷写。"
---

# UDS 诊断协议攻击

## 适用场景与不适用场景

**适用**:
- 授权测试中经 OBD 口/网关到达诊断服务层: 枚举 ECU → 试认证 → 读写数据 → 刷写面评估
- ECU 固件审计(有固件时): 提取 seed-key 算法评估其强度
- 防御评估: 0x29 认证部署、会话状态机正确性

**不适用**:
- 链路层(CAN 注入/bus-off)→ `auto-can-attack`
- 无物理接触的远程路径 → `auto-ecu-ivi`
- 未授权实车实验(法律红线,同 CAN 纪律)

## 服务速查(攻击者视角)

| 服务 | 语义 | 攻击者关心什么 |
|---|---|---|
| 0x10 | 会话切换(01 默认/02 编程/03 扩展) | 状态机缺陷: 降级不清锁、跨会话权限保持 |
| 0x27 | SecurityAccess(请求种子/提交密钥) | **全部安全性的单点**: 算法保密+种子管理 |
| 0x22/0x2E | 读/写 DID | 敏感 DID(标定/密钥/配置)是否受 0x27 保护 |
| 0x31 | 例程控制 | 隐藏例程(自检/工厂模式) |
| 0x34-0x37 | 请求下载/传输/完成 | 刷写=任意代码植入面(是否要求编程会话+解锁) |
| 0x29 | 认证(2020 版新增) | 存量车部署率低 |
| 0x3E | TesterPresent | 保活;功能寻址 0x7DF 广播枚举入口 |

## 方法学步骤

1. **协议打底**: 跑 `embedded-auto-research/reproductions/can_uds_sim.js` Demo 4-5——合法流程、未认证拒绝(NRC 0x33)、算法提取攻击、复位种子重放、0x7DF 枚举,四类场景全部可断言复现。
2. **枚举**: 功能寻址 0x7DF 发 [10 03],收集各物理地址(0x7E8/0x7EA/0x7EC…)应答 → 诊断拓扑图;对每个 ECU 跑 0x22 F1 87(时间身份)/F1 95 等无害 DID 指纹。
3. **认证面评估**(逐 ECU):
   a. 0x27 01 请求种子: 是否总是可用/是否有延时惩罚;
   b. 种子质量: 多次请求看是否变化;**复位 ECU(或断开重连)后种子是否重复**——重复=重放攻击面(can_uds_sim.js 场景 C);
   c. 错误密钥惩罚: NRC 0x35/0x36,尝试次数限制与锁定时长。
4. **固件侧分析**(有 dump 时,衔接 `emb-firmware-extraction`): 定位 seed-key 算法(常为异或+旋转/查表混淆)——算法在手,0x27 对你形同虚设(场景 B);同时检查算法本身是否可逆出"主密钥"。
5. **数据面**: 枚举 DID 空间(0x22 逐段试, NRC 0x11/0x31 区分未支持);敏感 DID(0xF15A 类标定、密钥存储)是否被 0x22/0x7E/0x33 正确拦住。
6. **刷写面**: 0x34 是否要求编程会话+解锁;未解锁可下载=任意代码植入(最严重发现)。
7. **会话状态机**: 0x10 01 降级是否清安全状态;0x11 ECU Reset 后 0x27 状态与种子 PRNG 是否复位(复位重放的温床)。
8. **工具化**: python-udsoncan+python-can 脚本化(记录每步请求响应作为证据);Caring Caribou 的 uds 模块做半自动枚举。

## 关键细节与常见坑

- **0x27 的安全性=算法保密性,不是密码学**: 算法藏在固件里,固件可读=认证失效——报告结论要指向"密钥体系"(0x29/非对称认证)而非"换更强的混淆"。
- **复位重放不需要任何密码学突破**: 只要种子 PRNG 复位后回到固定状态,"拔插保险丝+重放旧 key"即可——检查点写进评估清单。
- NRC 语义别记错: 0x33=security denied,0x35=invalid key,0x36=超次,0x7E=当前会话不支持,0x11=服务不存在——脚本按 NRC 分支,报告按 NRC 定性。
- 功能寻址请求会打到**所有** ECU: 枚举很爽,但 0x10 03 广播会把全车 ECU 拉进扩展会话(可能触发超时复位/DTC)——评估时评估,别在生产车上乱扫。
- ISO 14229-1:2020 是当前主流版本,旧车常实现 2013/2006 版(0x29 不存在是常态不是漏洞)。
- CANdid(USENIX Sec'24)等针对 seed 生成的研究: 本库题录未完全钉死(knowledge/05 存疑 #6),引用前复核。

## 参考实现与工具

- `embedded-auto-research/reproductions/can_uds_sim.js`——UDS 全流程+四类攻击场景仿真(24 项断言,ISO-TP 分帧含 KAT)
- python-udsoncan(pylessard)+ python-can——脚本化底座;SavvyCAN 抓诊断流量;Caring Caribou 攻击模块

## 已验证参考文献(引用前查 knowledge/05 纠错节)

- ISO 14229-1:2020 UDS / ISO 15765-2 ISO-TP——服务与传输层规范 [高]
- Beneath the Bonnet, ESORICS 2018——重载车辆遥测 dongle 攻击 [中(题录待复核)]
- CANdid, USENIX Security 2024——UDS 弱种子研究 [中(题录待复核)]
- The Car Hacker's Handbook(Craig Smith, 2016)——诊断实操章节 [高]
- ISO/SAE 21434 + UNECE R155——防御义务框架 [高]
