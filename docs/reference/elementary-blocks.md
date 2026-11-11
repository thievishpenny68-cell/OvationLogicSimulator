# 基本功能块（0.21.0）

0.37.0/核心0.27.0：其中POLYNOMIAL模型升ref1100-2006-polynomial-v2，追加相同Float32输入/系数的完整五次公式精确参考，分歧整拍拒绝。旧v1完整记录须重跑；其他本页算法模型不变。详见exact-sum-check.md。

按本地REF_1100（2006-05）正文、参数表和功能图补充17种基本算法。均支持放置、配置、接线、示波探针、保存重开；外形、内部标记和针脚排列遵循各自手册。

|模块|手册位置|行为|
|---|---|---|
|COMPARE|§4.22 p77|IN1/IN2模拟，ENBL可选数字；OUT相等、OUTG大于、OUTL小于。未接使能直接比较；接入FALSE时三个输出FALSE。精确比较，不加epsilon。|
|COUNTER|§4.24 p79～80|IN1/ENBL数字，DRCT=1递增、0递减，TARG模拟可接线或固定。按p80先用计数前ACT比较OUT，再在ENBL/IN1均TRUE时加减1。持续TRUE每扫描计数；ENBL FALSE装载递增0/递减TARG。|
|DIGCOUNT|§4.30 p125|NMIN选择1～12个连续数字输入，OUT为TRUE数量，FOUT为数量≥固定MTRU。原表列出IN12，按表保留第12路；NMIN/MTRU须为合法整数。|
|HIGHLOWMON|§4.45 p186|IN1/HISP/LOSP模拟，OUT数字。高于HISP或低于LOSP置位；严格低于HISP-HIDB且高于LOSP+LODB复位，其余保持。限值可接线或固定。|
|SELECTOR|§4.93 p332～333|NMIN选择1～7个模拟输入，DIN1/2/3是数字地址，分别权重1/2/4；地址0或大于NMIN输出0。|
|RESETSUM|§4.85 p307～309|IN1模拟，FFLG/RSET/RUN数字；OUT/FOUT模拟。按p309先非零TRST预置OUT；RUN TRUE计算TEMP=OUT+GAIN×IN1；FFLG TRUE保存TEMP至FOUT；随后RSET选择RCNT或TEMP作为OUT。RUN FALSE保持FOUT，非零TRST仍按第一条执行。|
|TRANSFER|§4.118 p407～410|FLAG数字FALSE选IN1、TRUE选IN2；模拟输入分别增益/偏置后限幅。当前SLEW=OFF、OTRK=OFF，无内外跟踪；TRIN/TRK1/TRK2不参与计算。|
|SQUAREROOT|§4.106 p365～367|IN1×IN1G+IN1B为正则开方，否则0；然后BTSC/TPSC限幅。当前无跟踪。|
|LOG / NLOG|§4.57 p213 / §4.65 p252|常用/自然对数加BIAS；IN1≤0按正文返回Float32(-3.4e38)。|
|SINE / COSINE / TANGENT|§4.96 p337 / §4.23 p78 / §4.114 p401|输入为弧度，输出对应三角函数。使用实际输入值，不将附近Float32值猜成精确π/2。|
|ARCSINE / ARCCOSINE / ARCTANGENT|§4.11 p42 / §4.10 p41 / §4.12 p43|输出为弧度；反正弦/反余弦输入须在[-1,1]内，域外无效数/报警路径明确停止。|
|POLYNOMIAL|§4.75 p288～289|CX0～CX5的五次多项式；按显式Float32幂、乘积、求和计算，核对较高精度候选的最终输出。|

## 初态和精度

引脚类型固定。数字引脚只能接数字量，测试源只提供开关量调整。NMIN改变选用引脚，取消端口的旧连接须处理后才能运行。

COUNTER须明确OUT/ACT初态，RESETSUM须明确OUT/FOUT初态，HIGHLOWMON须明确OUT初态。多输出块的各输出初值可分别编辑，保存和运行记录完整保留。新建NMIN/MTRU等是可修改的工作配置，导入仍不补缺失参数。

COUNTER当前仅执行绝对值小于2^24的精确整数加减；其他数值参与加减时明确停止并整拍回滚，不猜大计数饱和。所有块限GOOD质量、正常有限Float32或0；非GOOD、无效数、未支持字段与跟踪绑定继续明确提示或阻止运行。

三角/反三角/对数采用浏览器数学函数后转Float32。41组独立Python公式/binary32向量与当前输出精确一致，这是具体向量证据，不是全输入域或硬件逐位保证。多阶段计算沿用已有精度候选核对：有效输出/布尔决策不同则拒绝该扫描。布尔、精确整数及随包参考采用零容差；外部对照须明确绝对/相对/时间容差。

## 直接试用

打开`examples/elementary-blocks.json`单步6次，两台示波器观察计数、表决、选择、冻结累加、监视和切换；COMPARE有三路输出。`elementary-blocks-reference.json`独立填写6拍12路共72个输出及12个初态，可在轨迹对照中核对。

OFFDELAY/ONESHOT按手册完成当前固定参数范围。打开`examples/timer-manual-review.json`单步9次，配套参考提供36个OUT/ACT和4个初态，包含下降延伸、输入下降不断脉冲、重触发清零和到期保持。零/小目标、BASE0、负值、初态及回滚另有内核测试。参考来自手册及公开采样规则的独立推导，不是模拟器生成或Ovation采集；扫描离散化见`edge-timer-state-machines.md`。

## 暂缓范围

设备/顺控、PID及前馈、蒸汽燃气特性、复杂跟踪与质量传播、共享打包点、过程动态滤波/预测和大型函数表等留待后续。反对数边界限幅、查表及其他未加入类型也不作隐含支持；未知块继续保留并提示，不映射成近似模块。当前清单以库和支持矩阵为准。
