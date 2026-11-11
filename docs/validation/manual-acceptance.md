# 离线使用检查

1. 完整解压，断网后用Chrome或Edge打开index.html。
2. 点击“示例”，100ms周期单步5次到0.5秒，记忆输出应为TRUE；到2.5秒复位为FALSE。
3. 打开examples/input-waveform-trial.json，检查0.35秒阶跃预览，以及0.3秒旧值、0.4秒新值。
4. 打开examples/oscilloscope-four-channels.json，检查四路颜色／名称／值、量程、游标和满窗FIFO显示。
5. 保存工程并重开；导出完整运行记录后复算，核对一致后再明确载入。
6. 用输入页相邻按钮下载Excel模板并回导，先预览再应用。

记录浏览器版本及具体失败步骤。上述检查是软件行为复核，不等同Ovation现场运行对照。详细操作见guide.html。
