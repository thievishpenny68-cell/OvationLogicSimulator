# 运行记录与布局合同

0.66.0/引擎0.30.0：强制输出仅保留当前页面，不写普通工程。带强制的完整运行记录使用版本4证据副本，明确声明强制模型、逐引脚请求／实际值，快照另存未强制计算值；完整复算核对这些内容。主动载入复算结果仅在本页恢复强制，普通项目保存仍不携带。详见[临时强制输出](output-forces.md)。

0.63.0/引擎0.29.0加入禁用执行范围。未采用禁用功能的工程仍是版本2；采用后为版本3，并声明`dependency-closure-v1`。完整记录保留整图，在`manifest.executionScope`中列出`disabled`、`suspended`、`active`；快照只记录参与块，禁用部分不补0/FALSE。复算核对这份声明，旧版2记录沿用原模型合同。禁用状态属于运算配置，会改变计算指纹并清除旧运行；详见[禁用模块](disabled-blocks.md)。

0.37.0/引擎0.27.0：SUM改为ref1100-2006-sum-exact-check-v3，QAVERAGE/POLYNOMIAL改为各自v2；旧受影响完整记录拒绝，普通工程可重新运行。精确参考使用的BigInt仅为临时计算，不进入项目、快照或运行记录。

0.36.0/引擎0.26.0：SMOOTH模型升ref1100-2006-smooth-v2，旧v1完整记录明确拒绝，不补写新版本；普通工程仍可重跑。共享消减误差导致的失败按既有SCAN_FAILED记录，可完整复现失败扫描与未变快照。

0.35.0/引擎0.25.0补齐适用模型重叠声明的核对：主要模型声明仍必需；例如stateful且arithmetic的算法若在stateModels和arithmeticModels同时声明，两者都必须匹配当前支持模型，冲突时拒绝复算。旧记录只有主要模型声明时仍可按原合同核对。SMOOTH旧OUT已由完整前拍OUT表达，不添加重复隐藏状态。

产品/引擎0.5.0。算法profile、扫描模型和计时模型不变。工程schemaVersion仍为2；新建工程标记engineVersion，打开旧工程保留已有来源标签，实际运行引擎以manifest.engineVersion为准。

## 布局与运行

节点位置、名称、工程标题和示波器是明确的显示字段。节点移动及其撤销/重做保留已有运行、历史游标、输出和状态；运行中可移动节点。端口和探针跟随几何位置。参数、初态、质量、节点/边/模型或来源校验变化仍按原规则复位，不把不同计算配置的轨迹混在一起。参数表单“应用参数”仍是显式配置操作。

原运行在开始时固定工程副本，因此manifest.project保留起始布局/显示设置；当前布局另用“保存项目”保存。移动不会修改旧运行的配置或指纹。重新从新布局运行时，完整工程指纹会不同，计算配置指纹保持一致。

## 指纹

manifest.fingerprints包含algorithm=SHA-256、canonicalization=sorted-json-v1、simulationProjection=omit-display-v1，以及project/simulation两个各含64个十六进制字符的字符串（各256 bit）。

规范化先遵守JSON保存语义，再按JavaScript默认UTF-16码元顺序递归排序对象键。数组顺序保留，字符串不作Unicode归一化，数值使用JSON表示；undefined对象字段省略、数组空位/无效JSON数值按JSON语义处理，-0保存为0。运行参数仍先经过核心严格类型/有限数值校验，规范化不替代校验。非JSON可保存对象明确拒绝。

project覆盖完整起始工程。simulation仅排除顶层scopes/title及当前nodes中的x/y/name；其他字段包含参数、初态、质量、端口/连线、来源、任务约束、诊断和库均保留。不进一步合并数学上可能等价的配置，也不排序数组来猜测等价。显示比较使用同一投影的完整规范化文本，不依赖哈希碰撞来决定是否保留运行。

指纹在创建固定运行副本时计算一次，不参与每拍运算，也不从墙钟获得状态。它标识保存内容，不是签名、来源真实性证明或Ovation准确性等级。算法实现已经分别与Node crypto及浏览器WebCrypto交叉核对。

## 结果范围与诊断

manifest.resultRange记录firstTick/lastTick、firstTimeUs/lastTimeUs、executedScans、snapshotCount。起点为t0，snapshotCount是已提交状态数（含初态），不是调用snapshot()生成的对象副本数；完整界面导出trace长度与其一致。微秒字段为整数逻辑时间；首扫描仍在一个周期，不用墙钟推进。

失败扫描不提交快照，也不让范围前进。manifest.diagnostics保留最后一次失败尝试：SCAN_FAILED含tick、timeUs、nodeId和错误；TIME_INDEX_RANGE不伪造不再精确的微秒值。成功扫描或reset清除此失败记录；reset回到t0和一份初始状态。

comparisonTolerances为null，表示该运行记录未附参考验收容差；界面实际采用的abs/rel/time容差、声明来源、两份轨迹和实际运行manifest保存在单独的对照报告中。不能将null、指纹一致或软件复跑一致解释为Ovation运行对照通过。

0.7.0运行记录增加monitorModels，明确HIGHMON/LOWMON采用ref1100-2006-monitor-v1；动态限值连线或固定值、死区、OUT初态及各拍memory均随原工程/完整轨迹保留。既有算法和计时模型不变；实际engineVersion为0.7.0。

产品0.8.0提供离线“复算记录”入口，核心仍0.7.0。按已声明模型和完整快照核对后可载入当前引擎复算结果，报告包含双方版本、完整工程/计算指纹、声明与实际范围和有界差异；不等同原版本执行或现场准确性证明。详见record-recompute.md。

核心0.7.1统一检查已提供的initial结构与字段。早期记录若包含曾被忽略的未知初态，现在明确拒绝执行/复算并保留原字段；不会通过删除字段、重命名别名或补猜状态来使其通过。合法原记录仍按相同数值与时序模型复算，实际引擎版本会标明差异。

核心0.7.2拒绝波形中的未知字段或损坏结构；旧记录若依赖曾被忽略的timeUnit/repeat等，现在明确报错，复算不删除未知字段来通过。已知合法波形及算法仍按原模型重算。人工重设的旧波形随节点provenance.waveReplacements保留，属于新的配置与指纹，不把重设后的结果声称为原记录复现。

核心0.8.0新增numericValidationModel=f32-f64-output-agreement-v1和arithmeticModels.GAINBIAS，计时/监视模型升级v2。精度分歧按SCAN_FAILED记录节点/扫描/逻辑时间与完整候选说明，范围仍只覆盖已提交快照。复算对使用相关块要求当前声明，不把旧单一候选记录升级冒充新模型；详见precision-validation.md。

核心0.8.1增加当前参数与人工来源采用记录的一致性检查，不改既有运算/数值模型。记录工程中最新bind若与参数值、算法类型或固定限值驱动状态不符，会在复算启动前报PARAMETER_BINDING_STALE。不能以历史采用依据代替当前配置确认；可先将工程作为项目打开并明确修复，再生成新的运行记录，原记录不静默改写。

0.19.0/核心0.12.0为实际使用的AAFLIPFLOP/PULSECNT新增stateModels（分别ref1100-2006-aaflipflop-v1、ref1100-2006-pulsecnt-v1）。完整复算要求当前对应声明并核对firstPass/沿记忆等所有快照字段；缺失或未知模型拒绝。参考对照也核对双方已声明stateModels，冲突不能因数值相同而通过；不含新块的旧记录不增加此项要求。见edge-memory.md。

## 0.26.0共享LP字

含共享点的记录在快照中增加packedPoints（扫描结束字）和packedReads（各块执行时读入），两者都参与完整复算；同名写者输出别名同步至该记录当前值，解包输出保留各自执行时读取的位。非共享项目不增加空字段。PACK16/UNPACK16有明确stateModels声明；改共享身份/初态使扫描确认过期。具体合同见packed-words.md。
