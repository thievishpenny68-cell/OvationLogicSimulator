# Ovation Logic Lab 1.0.0

轻量、离线的控制逻辑编辑与模拟工具。完整解压后，用Chrome或Edge打开index.html，无需安装运行环境。

- 内置52种受限手册算法，支持拖放、参数配置和端口连线。
- SVG Control Sheet导入、自动端口映射、来源对照和明确诊断。
- INPUT波形编辑、两列Excel导入和模板下载。
- 四路示波、历史游标、固定窗口FIFO输出总览。
- 禁用／溯源恢复、临时强制输出和临时绘画标注。
- 工程保存、完整运行记录复算、参考对照和图文错误反馈。

## 使用

1. 保留index.html、guide.html、src、docs、examples和templates的相对位置。
2. 先在“示例”中单步，再配置自己的逻辑。说明见[guide.html](guide.html)。
3. examples内为通用演示数据；Excel模板位于templates/input-waveform.xlsx。

src为完整浏览器源码，可直接查看和修改。此包保留运行与使用资料，不含原始工程资料、映射表、开发依赖、测试日志或版本库历史。默认参数的出处保留手册章节／页码，不携带本机资料路径。

已支持范围、数值规则和错误检查优先于覆盖数量；未实现模式、缺失前提及精度分歧会明确阻止运行。尚无Ovation逐扫描现场运行对照，不是完整控制器复刻。

第三方组件及许可见[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
