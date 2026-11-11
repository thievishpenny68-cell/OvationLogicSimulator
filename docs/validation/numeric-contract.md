# 正常数值模式与误差判据

当前0.38.0/核心0.28.0：DBEQUALS v2追加基于实际Float32值的精确差值布尔参考，只拒绝最终决定分歧；SUM v3、QAVERAGE/POLYNOMIAL v2精确公式核对保持。范围见../reference/dbequals-exact-check.md及exact-sum-check.md，不放宽正常数值合同。

规则profile：ref1100-2006-normal-v1；当前产品0.36.0、引擎0.26.0。基础数值规则自0.3.0保持，精度候选核对自0.8.0起逐块扩充。ONDELAY v3恢复累计，OFFDELAY/ONESHOT v2；SMOOTH v2增加指数消减候选，SUM四路v2；完整52种算法的范围见`../algorithm-support-matrix.md`及各reference文档。该模式不宣称所有Ovation平台的中间精度、启动或异常数处理均相同。

## 文档依据与软件选择

- REF_1140（2005-08）§2.2.5：AV点值以IEEE 32位实数表示。REF_1100（2006-05）§2.4.1描述32位格式及无效/反常数处理，不同算法并非统一处理。
- 本软件只开放GOOD质量及正常有限Float32/零。NaN、无穷、次正规输入和溢出/次正规中间结果明确报错，失败扫描不提交部分结果；这是限定支持范围，不是假装复刻全部异常行为。
- 输入源、模拟初态及运行输出均转换为Float32。用户填写的配置原值保留在项目/运行manifest中；快照显示转换后的值。t=0仍是显式初始快照，不执行组合逻辑。
- ABSVALUE对已转换输入求绝对值。GAINBIAS先转换输入、参数及上下限，乘积舍入到Float32，随后加偏置再舍入，最后限幅。分阶段舍入为明示的软件运算契约；AV格式文档不能单独证明现场也使用相同的全部中间步骤。
- 三种计时块以整数逻辑微秒保存当前计时段，依次将秒数、除BASE、加ACT锚点的结果转换为Float32；比较当前ACT与TARG，不夹紧跨目标值。计时首拍及小目标分支见reference/ondelay-state-machine.md和reference/edge-timer-state-machines.md，不从该软件时钟推断现场平台的中间精度。
- 布尔量只接受true/false，不按JavaScript真值转换。显式给出未知或非GOOD质量（包括null/空值）会阻止运行。
- LP整字使用独立uint16类型0～65535；它不是模拟量，也不是整字到布尔的隐式转换。当前PACK16/UNPACK16、相同记录ASSIGN、FIRSTOUT与BCD支持范围见相应reference文件；未知位地址仍阻断。
- SMOOTH v2保留原两候选，并用`-expm1(-Δt/SMTH)`避免小权重在`1-exp(...)`中消失；识别到共享消减分歧时整拍拒绝。独立100位Decimal反例见`smooth-cancellation-vectors.json`。多种有限精度候选一致仍不是无限精度或Ovation平台等价的证明。

## 回归与参考误差标准

离散期望必须精确相等。自核心0.8.0起，不同精度候选输出不同会阻断；下列separate-product-sum向量的0仅为原分步预测，当前应报精度未确定。其余无分歧向量保留按位回归。以下正常数值向量在内核回归中按IEEE binary32位模式匹配；独立Python struct运算已核对相同期望，详情见numeric-vector-crosscheck.json。它们证明当前软件契约的实现，不是Ovation实机对照。

|向量|期望输出十六进制位模式|
|---|---|
|abs(-0)|00000000|
|abs(-最小正常Float32)|00800000|
|abs(-最大有限Float32)|7f7fffff|
|abs(-0.1)|3dcccccd|
|x=1+2^-23，GAIN=1+2^-23，BIAS=-(1+2^-22)，不触及限幅|00000000|
|x=16777216，GAIN1，BIAS1，不触及限幅|4b800000|
|x3，GAIN2，BIAS1，上限5|40a00000|
|x0.5，GAIN-2，BIAS-0.25，下限-1|bf800000|

初态0.1须在初始快照和复位中均为0.10000000149011612，不能初态保留双精度、执行后才转换。一次失败扫描须保留上一拍全部值、状态和tick。

外部参考轨迹必须明确绝对/相对/时间容差：模拟量要求`|当前-参考| ≤ absTol + relTol×|参考|`，数字量精确一致，同tick的时间差不超过timeTol，不做插值。缺失、类型错误及不同规则版本均单独报告。±0在数值对照中等价，JSON不保留零的符号；不提供跨JSON保存的有符号零位级保真声明。

当前尚未取得现场逐扫描采集，不能给出已验证的现场统一容差。界面显示的零容差只是明确的起始设置，不能把某个宽松容差下通过称为整算法已验证。取得参考后应随平台/版本、记录精度、量级和工况记录适用的误差标准与结果。

逐扫描表格和对照差异显示数值的完整可往返文本，避免相邻Float32被七位简写显示成相同值；画布和坐标轴仍采用简写，详细输出/内部状态保留原值。

0.7.0监视块模型ref1100-2006-monitor-v1：有效限值/输入/死区采用正常有限Float32。先执行手册严格跳闸判断；进入复位分支后，HISP-HIDB或LOSP+LODB再舍入为Float32后严格比较。12组Python struct独立位向量验证软件模型在半ULP与相邻输入处的结果；手册未明示中间精度，尚无Ovation采集验证，不声称逐位等价。未实现无效实数保持并置BAD的手册质量路径，当前明确报错并回滚整拍。

0.8.1轨迹对照增加模型声明核对：双方已提供的profile、scanModel、numericMode及同名timerModels/monitorModels必须一致，否则整体matched=false，仍单独报告样本差异。空字符串/错误类型/损坏manifest不能按缺省跳过。旧记录或人工轨迹未声明的信息通过modelStatus=partial和modelChecks列出；允许数值对照，但不证明模型一致。引擎版本、工程指纹及顺序配置不在此选定通道对照中证明等价；完整软件记录复算另见reference/record-recompute.md。

资料补充（2026-11-01）：OW360_R1100（2016-05，Ovation 3.6.0）§2.5 p6区分单精度点值与可使用双精度的内部计算，参见[原厂手册第三方转录](https://www.scribd.com/document/1074913829/OW360-R1100)。这进一步说明AV32位不足以证明逐步Float32，也未指定GAINBIAS必须用双精度。本2006 profile保持已公开数值合同，G02的一ULP候选差异不标为Ovation逐位通过，不根据新版存在就更改旧模型。

核心0.8.0新增numericValidationModel=f32-f64-output-agreement-v1。对GAINBIAS限幅后的OUT、监视器实际布尔OUT、计时ACT及进入小目标分支核对已识别的精度候选；精确值不同则整拍失败，不以比较容差放行。候选binary64不是无限精度，也未验证其为Ovation实现，候选一致不证明全部硬件行为。新旧模型声明/范围见reference/precision-validation.md。原8组静态binary32预测保留，不将分歧向量改写成通过值；监视器12向量保留两类预测，10组可执行、2组应明确阻断。

0.19.0/核心0.12.0新增PULSECNT非负精确整数计数范围0～2^24。每个允许的+1都可精确表示为Float32；超界新脉冲明确拒绝并整拍回滚，不以Float32舍入静默漏计或猜测溢出。AAFLIPFLOP只做布尔首次/沿/复位处理，既有算术与计时模型不改。详见reference/edge-memory.md。
