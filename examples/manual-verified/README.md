# 手册明确工况：直接运行与对照

本目录对应已有手册审查的5组、23项非定时OUT读数。原厂基准REF_1100（2006-05）§4.40、§4.42、§4.46、§4.59；详细审查见包内docs/reviews/03-manual-web-review.md。它们验证这些具体工况，不能推广到全部算法模式、计时相位或现场版本。

|打开工程|单步次数|每次单步后的OUT|
|---|---:|---|
|G01.json|1|1.25|
|F0.json|5|FALSE、TRUE、FALSE、FALSE、FALSE|
|F1.json|5|FALSE、TRUE、TRUE、TRUE、FALSE|
|H01.json|6|FALSE、FALSE、TRUE、TRUE、FALSE、FALSE|
|L01.json|6|FALSE、FALSE、TRUE、TRUE、FALSE、FALSE|

在软件中“打开项目”，选择其中一个工程，按上表单步。每份已有一台示波器接入算法OUT，也可点击算法查看输出和记忆状态。初始扫描0是显式软件初态，不是第一项运算结果；F/H/L初态特意设TRUE，第一项输入按手册建立FALSE状态。

对照方法：

1. 完成上表的单步次数，展开“选择输出 / 内部状态”，先“清空选择”，只勾选算法块（如FLIPFLOP）的OUT；其编号为algorithm，不选输入源或内部memory。
2. 在“轨迹对照”载入同名的`-reference.json`，来源选“人工整理”，填写手册及工况依据。
3. 绝对、相对、时间容差均为0，点击“对照所选信号”。应无样本差异，G01/F0/F1/H01/L01分别比较2/6/6/7/7个点，其中各有1个初态点；执行结果共23项。

参考OUT来自此前独立手册期望，没有从本次模拟输出生成。步间0.1秒只为软件演示安排，原审查为稳态读数，不能当作现场连续扫描时间。参考没有现场模型声明，因此“模型未完全核对”属预期状态；数值匹配不应提升为Ovation运行采集通过。

`G02-precision-stop.json`是另一类示例：单步第一拍应报告中间精度未确定，扫描仍为0，完整初始快照保留。输入0.7、GAIN1.1、BIAS0.3的不同中间舍入产生相邻Float32候选，现有资料不能指定某个真实读数，因此不提供伪造的G02参考。

所有文件可离线打开，无需开发工具。工作区核对工具`tools/check-manual-examples.cjs`会重跑上述工况并输出逐项报告；包内`docs/validation/manual-case-results.json`记录当前软件核对结果，`ovationRuntimeEvidence=false`保持。保存工程后可重开复跑；修改参数或输入后，原参考不再代表修改后的工况。
