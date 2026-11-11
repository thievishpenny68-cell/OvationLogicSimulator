# 基本算术、差值与高低选

0.18.0起，新增DBEQUALS、SUM、MULTIPLY、DIVIDE、HISELECT、LOSELECT。其中SUM现支持IN1/IN2必接、IN3/IN4可选，其余当前采用两路模拟输入IN1/IN2；DBEQUALS输出为数字OUT，其余为模拟OUT。DIVIDE的NUM/DEN针脚名称对应IN1/IN2，增益偏置IN1G/IN1B/IN2G/IN2B别名对应NUMG/NUMB/DENG/DENB，导入时保留原名称作为来源；冲突别名不择一。

|块|当前规则|原始手册|
|---|---|---|
|DBEQUALS|d=abs(IN1−IN2)；d>DBND置TRUE，d<abs(DBND−RTRN)置FALSE；两条相等边界及中间范围保持OUT。须显式布尔OUT初态，当前范围0≤RTRN≤DBND|REF_1100 §4.25 p81|
|SUM|2～4路分别做增益偏置后相加并限幅；IN3/IN4可选，未接路及偏置不参与|§4.112 p396～398|
|MULTIPLY|分别做增益偏置后，两路相乘并限幅|§4.64 p249～251|
|DIVIDE|先变换分子a、分母b；b≠0时a/b；b=0时a≥0取上限，否则取下限，所以0/0取上限|§4.33 p151～153|
|HISELECT|分别做增益偏置后取较大值，再限幅|§4.47 p188～192|
|LOSELECT|分别做增益偏置后取较小值，再限幅|§4.58 p214～218|

DBEQUALS的TRUE表示差值超过死区，不能根据“EQUALS”名称改成相等为TRUE。默认DBND/RTRN均0时，差值回到0处属于相等边界，会保持此前状态，严格按手册比较而不加epsilon。

算术和高低选先计算a=IN1×IN1G+IN1B、b=IN2×IN2G+IN2B；DIVIDE界面使用NUMG/NUMB、DENG/DENB。增益默认1、偏置默认0、TPSC默认100、BTSC默认0；下限不得大于上限。SUM/MULTIPLY禁止第一路增益初始化为0，高低选禁止第一/二路增益初始化为0；DIVIDE没有照搬这一限制。

当前为GOOD质量、正常有限Float32/零、无跟踪；SUM已开放IN3/IN4及独立增益/偏置（见`sum-four-inputs.md`），其他上述块当前为两路。高低选IN3/IN4仍未开放；手册高低选第3/4路公式有G/GB印刷差异，本轮不猜选。TRIN、TOUT、TRK等跟踪端不参与执行，不提供伪造的跟踪输出；接线会报错。来源中的未支持输入绑定会保留并阻止运行，普通“人工确认”不能解除。仅声明未使用的跟踪输出会明确提示未仿真；一旦有实际连接仍禁止执行。

TRAT默认2.5，作为跟踪速率参数保留在工程及来源；当前无跟踪，界面注明它不参与OUT计算。高低选QUAL使用手册文字WORSE/SELECTED/NOTBAD：当前输入都必须GOOD，三种选择的质量结果相同；不模拟非GOOD选择，也不猜X1的整数编码。未知编码原值显示并保留，修改其他参数不会把它删除，须明确选择支持的文字模式。

乘法和加法逐阶段转Float32，最终计算、限幅后与保留binary64中间结果的候选比较；DBEQUALS核对差值及返回阈值对布尔决策的影响；0.38起v2另用精确整数差值参考识别两条路径共享的消减，仅最终布尔不同才拒绝，见`dbequals-exact-check.md`。旧v1完整记录须按当前模型重跑，普通工程仍可使用。候选输出不同则整拍停止，保留上一有效快照。溢出、次正规中间值仍报错；没有为了通过示例放宽数值合同或误差标准。模型逐块记录在arithmeticModels或monitorModels，完整记录可复算；无Ovation现场采集声明。

## 直接试用

打开`examples/basic-blocks.json`，其中有六个块、两台已接探针的示波器。9次单步可看输入切换、算术/除零/限幅和差值回差：

|扫描|两输入|SUM|MULTIPLY|DIVIDE|HISELECT|LOSELECT|DBEQUALS|
|---:|---|---:|---:|---:|---:|---:|---|
|1|3、2|5|6|1.5|3|2|FALSE|
|4|−2、0|−2|0|−10|0|−2|FALSE|
|7|2、5|7|10|0.4|5|2|TRUE|
|9|5、5|10|10|1|5|5|FALSE|

示例上下限为−10/10，DBND=2、RTRN=1；0.4显示简写，完整值为Float32结果。表为手册公式推导的软件输入安排，不是现场逐扫描采集。示波器可拖动、调整大小及独立增减探针；保存重开可以复跑。

0.18.1起随包附独立静态参考`examples/basic-blocks-reference.json`。它保存上述输入下完整9拍、六块共54项OUT，以及t0的6项显式初态；期望没有从模拟器输出生成。0.4的固定Float32期望为0.4000000059604645（位模式3ecccccd），其余数值均精确可表示。

1. 打开`examples/basic-blocks.json`并单步9次。
2. 展开底部“逐扫描 / 对照信号（含内部状态）”，先清空，再选SUM、MULTIPLY、DIVIDE、HISELECT、LOSELECT、DBEQUALS的OUT，共六路；不要选两输入或DBEQUALS内部memory。
3. 打开“轨迹对照”，载入`examples/basic-blocks-reference.json`，来源选择“手册”，说明填写“六块公式推导，非现场采集”。
4. 绝对、相对、时间容差均设0，点击对照。应显示60/60样本、0项差异：其中54项为执行后的OUT、6项为显式软件初态。可导出本次对照报告。

参考没有声明现场引擎/扫描模型，结果仍明确标为模型信息未完全核对；数值匹配不会提升为Ovation现场等价。核对报告`docs/validation/basic-case-results.json`记录相同范围，不用于证明本例以外的全部模式。

新建块有公开默认值。导入图不因新注册算法而给缺失来源参数/初态填默认；SVG/MCR/TFT明确参数可恢复，缺失项继续在属性/问题清单补齐。标准资料保持只读。同名宏不借用这些标准块的参数或端口。

本轮不扩展PID、设备控制、复杂跟踪/质量切换、打包点状态；COMPARE、COUNTER及复杂2XSELECT未纳入这批实现，不用其他PLC习惯填补其规则。
