# 上升沿翻转记忆与脉冲计数

产品0.19.0、核心0.12.0新增AAFLIPFLOP和PULSECNT。依据用户提供的REF_1100（2006-05）§4.2 p25～26、§4.79 p296原页真值表和伪代码；正常质量GOOD，无控制器冷/热重启、冗余切换或BAD质量传播模拟。软件t0是显式初态快照，不执行算法。

|块|固定输入|固定输出|初态|
|---|---|---|---|
|AAFLIPFLOP|SRST、RSET数字；INIT可选数字|OUT数字|显式布尔OUT；内部firstPass=TRUE，previousSRST=FALSE仅作首次处理前的观察占位|
|PULSECNT|IN1、RSET数字|OUT模拟计数|显式OUT及previousIN1；新建为0/FALSE，导入缺失则阻止运行|

## AAFLIPFLOP

首次执行先判断RSET：TRUE则OUT=FALSE；否则有已接INIT就采用本拍INIT，没有INIT就保持显式OUT初态。首次执行不因SRST为TRUE而额外翻转。首次结束保存本拍SRST并清firstPass。

以后每拍RSET始终优先；未复位时仅SRST的FALSE→TRUE使OUT反转，持续TRUE、下降沿和持续FALSE均保持。每拍都保存SRST，包括RSET为TRUE的扫描，因此撤销RSET时不会把已保持的TRUE误当新沿。INIT以后不再参与OUT。

例如显式OUT初值TRUE、未接INIT、首次SRST=TRUE/RSET=FALSE，首次OUT仍TRUE；下一次先FALSE再TRUE才会翻转。软件复位重新建立显式OUT及firstPass；这不是完整Ovation电源/复位状态模型。内部memory、previousSRST、firstPass可由状态探针观察，不能作为算法针脚接控制线。

## PULSECNT

严格按手册伪代码先执行RSET清零，再检查新上升沿并加1，最后保存本拍IN1。持续高电平不逐扫描累加。

因此同拍RSET=TRUE且出现新上升沿，OUT为1；下一拍若RSET与IN1都仍TRUE，因没有新沿，OUT被清成0。这与AAFLIPFLOP的复位超驰翻转规则不同。

本轮计数限定非负整数0～16777216（2^24）；其中每一个整数及允许的+1都可精确表示为Float32。处于上界时再有新脉冲，明确停止并保留整拍前的所有输出、沿记忆和时间；不会静默把脉冲丢掉，也不猜大计数的内部精度、饱和或回绕。上界时RSET可先清0再计新沿。负值、非整数和超范围初值不在当前范围。

## 直接试用与对照

打开`examples/edge-memory.json`，单步9次。三路数字输入、两个基本块及一台双通道示波器均已连接；用户可移动块、示波器及自行增减探针。

|扫描|SRST/IN1|RSET|INIT|AAFLIPFLOP.OUT|PULSECNT.OUT|
|---:|---|---|---|---|---:|
|1|TRUE|FALSE|TRUE|TRUE|1|
|2|TRUE|FALSE|FALSE|TRUE|1|
|3|FALSE|FALSE|FALSE|TRUE|1|
|4|TRUE|FALSE|FALSE|FALSE|2|
|5|FALSE|FALSE|FALSE|FALSE|2|
|6|TRUE|TRUE|FALSE|FALSE|1|
|7|FALSE|FALSE|FALSE|FALSE|1|
|8|TRUE|FALSE|FALSE|TRUE|2|
|9|TRUE|FALSE|FALSE|TRUE|2|

展开底部“逐扫描 / 对照信号（含内部状态）”，清空后只选两个块的OUT；到“轨迹对照”载入`examples/edge-memory-reference.json`，来源选手册并说明为真值表/伪代码推导，三种容差均0。应匹配20/20样本：18项执行输出和2项显式软件初态。参考由表和伪代码独立推导，不从模拟器运行生成；时间是软件示例安排，非Ovation采集。参考未声明现场模型，报告仍明确模型信息未完全核对。

## 导入与保存复跑

SVG/MCR中的明确SRST/INIT/IN1/RSET引用可恢复连接及固定数字类型，已命名的INIT针脚可直接识别；不由位置猜针脚。未接INIT合法，缺少SRST/RSET或IN1/RSET仍报错。来源缺失OUT或PULSECNT沿初态需人工补齐，不根据点记录或OUT当前值猜初始化。同名宏保持自己的接口，不借标准块定义。

完整运行记录在`stateModels`按实际使用算法保存`ref1100-2006-aaflipflop-v1`或`ref1100-2006-pulsecnt-v1`。完整复算必须有当前对应声明，并核对所有内部状态；缺失/未知模型拒绝。参考对照也检查已声明stateModels的冲突；旧的不含这两种块的记录不新增此声明要求。失败扫描不消耗首次标志或输入沿，保存工程重开可复跑。
