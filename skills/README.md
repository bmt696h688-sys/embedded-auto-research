# 嵌入式/汽车技能库清单(第一批,10 个)

> **本目录 = 技能源文件(canonical)**: `emb-*/auto-*/SKILL.md` 共 10 个,随仓库版本化。
> **安装位置(运行副本)**: `C:\Users\Administrator\.zcode\workspace\default\.agents\skills\`(ZCode 标准发现路径);安装方式 = 把技能目录复制过去。
> 所有技能的参考文献均来自本知识库的已验证条目,并内嵌各域"纠错"警告。创建:2026-09-30。

## 使用方式

- **自动触发**: 描述嵌入式/汽车相关问题时,`emb-auto-router` 会先被触发做场景路由,再加载具体技能
- **手动调用**: `/skill emb-jtag-swd <你的问题>`
- 每个技能包含:适用场景 → 前置条件 → 方法学步骤 → 常见坑(含引用纠错)→ 参考实现 → 已验证文献(带置信度)

## 技能清单

| # | 技能 | 覆盖 | 参考实现 |
|---|---|---|---|
| 1 | emb-auto-router | 总入口:按接触模型/目标类型路由到其余 9 个 | reproductions/ 全部 |
| 2 | emb-jtag-swd | JTAG(IEEE 1149.1)/SWD 调试接口攻击 | jtag_tap.js |
| 3 | emb-uart-spi-i2c-recon | UART/SPI/I2C 侦察与 flash 直读 | stm32_bootloader.js(串行协议校验部分) |
| 4 | emb-readout-protection | RDP/APPROTECT 读保护绕过(毛刺谱系) | stm32_bootloader.js(Demo 3-5) |
| 5 | emb-firmware-extraction | 固件提取与解包全流程(bootROM/binwalk/EMBA) | stm32_bootloader.js |
| 6 | emb-iot-soc-cases | ESP32/RP2350/nRF52/Starlink 平台案例库 | jtag_tap.js + stm32_bootloader.js |
| 7 | auto-can-attack | CAN 注入/DoS/bus-off/IDS 对抗 | can_uds_sim.js(Demo 1-2) |
| 8 | auto-uds-diagnostics | UDS 0x10/0x27/0x22/刷写面攻击 | can_uds_sim.js(Demo 3-5) |
| 9 | auto-ecu-ivi | 车机/Telematics/远程攻击面/Pwn2Own | can_uds_sim.js |
| 10 | auto-keyless-rke | PKES/滚码 KeeLoq/Hitag2/RollJam | can_uds_sim.js(重放场景机理) |

## 配套知识库

`../knowledge/01-06`——每个技能的方法与文献引用都能在对应域 README 找到完整条目与置信度标注;引用前必读各域"纠错与存疑"小节。
