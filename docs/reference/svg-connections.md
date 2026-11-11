# SVG连线格式与支持范围

ControlAlgorithm、ExternalPointInterface和ControlMacroReference表示逻辑对象，ControlPin表示引脚。输出针脚下的SignalSegment树描述主线和分支，SignalConnection表示目标连接；连接归属由结构确定，不把交叉线自动相连。

解析器区分编码对象编号与原始id，结合图元归属、变换后的唯一端点、动态针脚名和目标属性中的源引用核验连接。只在身份、方向及接口含义足够明确时生成运算边，未知编码、重复身份、冲突和歧义均保留诊断。

程序保留原文及导入时的连接依据。移动模块只重绘显示，未解决连接不参与运算。自定义宏外框可以恢复针脚与连线，但不会因此获得内部仿真能力。
