# 信号质量

## 输入设置

选中模拟量（LA）或数字量（LD）的独立 INPUT，在下方「输入设置」展开「信号质量」。可选常量、阶跃和分段保持，时间单位为秒。信号值和质量在同一拍采样，共用「应用参数」。质量分段从首节点取起始值，最后一个节点之后保持最后设置。保存工程会保留已经应用的质量变化，旧工程缺省为 GOOD。

跨画布驱动的 INPUT 和宏内部的边界 INPUT 随来源读取数值和质量。跨画布正向读取本拍，反向读取上一拍。失败扫描的质量与数值一起回滚。画布块值旁显示非 GOOD 状态，右侧属性可查看各输出的质量，从全局回看可查看当拍状态。录波预设会随同数值保存、回放对应质量。

## 手册定义

REF_1140 §1.8–1.9（印刷页 7–8）定义四级点质量。LA、LD 的 1W 第 9、8 位编码见 §2.2.2 / §3.2.2。

| 质量 | 1W 第 9、8 位 | 含义 |
|---|---|---|
| GOOD | 00 | 正常 |
| FAIR | 01 | 一般，例如人为输入 |
| POOR | 10 | 较差，例如某些多输入算法报告部分输入异常 |
| BAD | 11 | 坏质量，例如传感器故障 |

REF_1140 §4.2.2、§4.2.6 指出 LP 的相应 1W 位未使用，A3 表示各位无效标记。本次按用户确认的范围处理 LA、LD 四级质量，LP 继续使用原来的 A2 数值路径。

## 已支持功能块的输入质量规则

下表适用于当前可执行端口和配置。质量与实数是否合法是两个条件。例如带 BAD 质量的有限模拟数仍可参与 SUM。手册所述无效实数、未更新点、硬件停止扫描、2W 原因和跟踪状态使用其他状态字段；模拟器的信号源每拍采样，有限 Float32 校验和现有数值错误诊断仍生效。

| REF_1100 章节 / 块 | 执行规则 |
|---|---|
| §4.2 AAFLIPFLOP | 首拍跳过 BAD 的 INIT，RSET 优先。输出质量按主要输入 SRST 的规则处理。 |
| §4.3 ABSVALUE、§4.9 ANTILOG、§4.10 ARCCOSINE、§4.11 ARCSINE、§4.12 ARCTANGENT、§4.13 ASSIGN、§4.23 COSINE、§4.41 FUNCTION、§4.57 LOG、§4.65 NLOG、§4.75 POLYNOMIAL、§4.82 RATECHANGE、§4.83 RATELIMIT、§4.96 SINE、§4.104 SMOOTH、§4.106 SQUAREROOT、§4.114 TANGENT、§4.119 TRANSLATOR | 当前正常实数路径传播 IN1。RATECHANGE、RATELIMIT 的输出不从辅助限值端取质量，TRANSLATOR 有效实数越界时保留旧数值并传播 IN1 质量。ANTILOG 的末句重复写“无效”，正常实数路径按主要输入规则。 |
| §4.25 DBEQUALS、§4.33 DIVIDE、§4.64 MULTIPLY、§4.109 STEAMFLOW | 取两路输入中最差的质量。 |
| §4.112 SUM | 取四路中实际接入输入的最差质量。手册质量段写作“两路”，计算公式为四路。采用用户确认的四路规则，未接输入按零值处理。 |
| §4.39 FIRSTOUT | 数字输出 MULT、TRPD 不传播数字输入质量。NTRP 使用首个已连事件输入的质量。 |
| §4.42 GAINBIAS | PROQ=ON 传播 IN1，PROQ=OFF 输出 GOOD。 |
| §4.46 HIGHMON、§4.59 LOWMON | 正常实数路径不传播 IN1 质量。 |
| §4.47 HISELECT、§4.58 LOSELECT | WORSE 取最差质量，SELECTED 取选定输入质量，相等取较好质量。NOTBAD 按用户确认的正文方案优先排除 BAD，全部 BAD 时按方向选值并输出 BAD。 |
| §4.52 INTERP | YOUT 取 XIN 和实际参与求值的 Y 端中最差质量，精确命中与越界钳位只用对应的 Y。VALID 继承 XIN。 |
| §4.71 PACK16 | BAD 的数字输入位保持原字中的原值。此处按正文“质量为差”的坏质量含义处理，LP 输出不配置四级质量。 |
| §4.80 QAVERAGE | 排除 BAD，剩余输入参与平均并取其最差质量，全部 BAD 时保留上拍值并输出 BAD。 |
| §4.85 RESETSUM | RUN 时从 IN1 更新质量。RSET 保留 OUT 的上一质量，FFLG 关闭时保留 FOUT 的上一质量。RUN 关闭时两者都保留。 |
| §4.92 SATOSP | BAD 的模拟量输入使 LP 字保留上一有效值。 |
| §4.93 SELECTOR、§4.118 TRANSFER | 传播当前选中的模拟量输入质量。SELECTOR 的空地址、超范围地址和未接通道输出 GOOD。 |
| §4.120 TRANSPORT | 正常实数路径输出 GOOD。 |
| AVALGEN、DVALGEN、TIMECHANGE、TIMEDETECT | 当前支持配置没有信号输入，输出缺省 GOOD。 |
| AND、BCDNIN、BCDNOUT、COMPARE、COUNTER、DIGCOUNT、FIFO、FLIPFLOP、HIGHLOWMON、NOT、OFFDELAY、ONDELAY、ONESHOT、OR、PULSECNT、RATEMON、SPTOSA、TRNSFINDX、UNPACK16、XOR | 手册未另定正常输入质量规则的输出继承主要输入。普通块优先第一个已接的 IN1、IN2 等数据端。只有其他命名端的块使用主数据端，例如 FLIPFLOP 的 SET。只有 LP 来源的数字或模拟输出缺省 GOOD。 |

## 工程与记录

工程的独立 INPUT 以可选 `qualityWave` 保存质量变化。完整运行记录用 `qualities` 保存每拍的非 GOOD 输出，在多画布记录中用 `signalQualities` 保存当拍发布的非 GOOD 共享信号。缺少字段等同 GOOD。使用质量配置时记录 `qualityModel`，复算同时核对值和质量。临时强制输出仍是模拟器的数值覆盖，沿用块计算得到的质量。

质量编码见《Ovation 记录类型参考手册》，各块的传播规则见《Ovation 算法参考手册》第 4 章。
