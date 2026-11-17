# RATELIMIT 和 UTC 时钟块

## RATELIMIT

无跟踪模式支持 LA 输入 IN1、可接 LA 的 RALM、LA 输出 OUT 和 LD/LP 位输出 FOUT。按本地 REF_1100 §4.83 p302–304 采用参数默认值 RALM=0、TPSC=100、BTSC=0、TRAT=2.5。TRAT 仅保留配置，TRIN/TOUT 显示在原厂图例中，跟踪输入与依赖 TOUT 的连线会阻止运行。

每拍增量 PLR = RALM × 扫描周期秒数。若输入与旧输出之差的绝对值小于 PLR，跟随输入并清除 FOUT，否则沿差值方向移动 PLR 并置位 FOUT。最后按 BTSC/TPSC 限幅。RALM=0 时每拍增量为零，等号分支仍置位 FOUT。

基准手册的增量写作 RALM，新版 OW360-R1100 §5.97 p492 写作 PLR。本模型采用新版功能伪代码，包括严格小于的比较。该版文字描述对等号的表述与伪代码有差异。逐步 Float32 结果和基于整数微秒、实际 Float32 输入的精确参考必须在最终 OUT 和 FOUT 上一致，存在分歧时整拍回滚。OUT 初态可配置，强制发布不改变私有的旧输出。

[Emerson OW360-R1100 §5.97](https://pdfcoffee.com/ow360-r1100-ovation-algorithms-reference-manual-pdf-free.html)

## UTC 起点

在“扫描设置”填写带 Z 的 ISO 8601 时间，例如 `2026-11-14T23:59:59.500Z`，点击“采用 UTC 起点”。两个时钟块共用该起点，按整数微秒扫描时间推进。设置随工程和运行记录保存，改变起点会更新仿真指纹。缺失或无效起点会阻止时钟块运行。

## TIMECHANGE

依据 REF_1100 §4.115 p402，每拍分别比较 UTC 小时、分钟和秒分量，与上一拍值不同则对应 HCHG/MCHG/SCHG 为 TRUE。内部旧分量以手册默认 0 开始，首拍可以产生脉冲。复位时输出为 FALSE。大周期只比较两个实际采样时刻的分量，跳过的变化不补发。

## TIMEDETECT

依据 REF_1100 §4.116 p403 及下一拆分页 p404 开头的补充说明。小时发生变化后，在 SHF1 指定的小时发出 DCHG。WEEK 取 1 至 7 表示星期日至星期六，在指定星期的 SHF1 小时发出 WCHG，0 停用。SHF2/SHF3 都为 0 时停用 SHFT，其余情况下 SHF1 和非零的可选班次小时各触发一次，重复小时合并为同一脉冲。SHF1/SHF2/SHF3/WEEK 默认均为 0。

TIMEDETECT 的软件初态以 UTC 起点的小时作为旧小时。复位输出为 FALSE，跨过而未采到的班次不补发。两个时钟块的数字输出均允许 LD/LP 位。以上是手册和可复算的软件约定，尚无实机逐拍记录。

[Emerson R3-1100 §3-108–109](https://www.powergenics.com/wp-content/uploads/2018/12/Ovation-Algorithms-Reference-Manual-R3_1100.pdf)

打开 `examples/ratelimit-and-utc-clock.json`，250 ms 单步 5 次。第 2 拍到达 UTC 午夜并触发换日、换班及换周。限速 OUT 依次为 2、4、6、4、4。参考文件 `examples/ratelimit-and-utc-clock-reference.json` 可按拍核对。
