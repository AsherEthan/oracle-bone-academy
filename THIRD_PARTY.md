# 第三方材料与发布范围

## 小學堂字例图片及属性

提供方：中央研究院小學堂文字學資料庫。

- 字例记录：`https://xiaoxue.iis.sinica.edu.tw/char?fontcode=<编号>`
- 字头查询：`https://xiaoxue.iis.sinica.edu.tw/jiaguwen?ZiOrder=<编号>`
- 许可声明：https://xiaoxue.iis.sinica.edu.tw/License/License
- CC0 1.0：https://creativecommons.org/publicdomain/zero/1.0/deed.zh_TW

许可声明明确将查询所得各解析度「字形圖片」及「字形屬性資訊」以 CC0 1.0 提供。本站保留提供方、查询地址、字例号、著录、下载地址及 SHA-256，图片保持原下载字节；没有分发小學堂字体软件。

GitHub 版本的 `research/` 只发布复核所需的查询属性摘录、结构化记录及原始 PNG。`.html` 是从本地研究快照抽取的属性片段，**不是完整网页快照**；保留查询数量、字头号、字例图片属性、现代目录标签和著录字段，去除来源网站脚本、事件处理器、样式及页面布局。许可页保留相关声明摘录。原始网页仍保存在本地研究档案中，不把许可扩大为整站内容的再发布许可。

未取得明确复用范围的其他网站资料、官方帮助 PDF、第三方站点 JavaScript、探索性下载及已撤下的自绘字形不随 GitHub 版本发布。相关研究结论和来源入口见 README。

## 辅助文献

12 条材料入口指向香港中文大学漢語多功能字庫：
https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/

本站只提供来源链接、简短讨论主题及引辞边界，不分发其数据库，不将相关字条视为当前每幅字例的配辞或充分释读证据。

## 界面字体与依赖

- 本地 Noto Serif SC 子集：SIL Open Font License 1.1，完整许可见 `public/fonts/serif/OFL.txt`。它是界面字体，不是甲骨文字体。
- npm 依赖分别适用各自软件包中的许可；`package-lock.json` 固定本次使用的依赖版本。

第三方材料的上述许可不自动成为本项目全部原创代码的统一授权声明。
