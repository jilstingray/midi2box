# MIDI2Box

将标准 MIDI 文件转换为 30 音纸带八音盒纸带谱。

![screenshot](https://raw.githubusercontent.com/jilstingray/midi2box/main/screenshot.png)

## 功能

- CLI + GUI
- 导入 `.mid` / `.midi` 文件
- 超出音域音符自动升/降调映射
- 量化、速度倍率、孔距检查
- 纸带预览和播放
- 支持 PDF/SVG 格式导出

## TODO

- [ ] 多音轨预览
- [ ] 音符编辑
- [ ] 界面优化
- [ ] 15 音纸带支持

## GUI

依赖：

- Node.js
- Rust
- Cargo（随 Rust 一起安装）
- Python 3

```bash
npm install
npm run dev
```

`npm run dev` 会自动检查 `node_modules`，缺少依赖时先执行 `npm install`，然后启动 Tauri 桌面 GUI。

也可以使用这些等价命令：

```bash
npm start
npm run gui
npm run desktop
```

## CLI

后端转换器可以不启动 GUI，直接作为 CLI 使用。CLI 从 `stdin` 读取 JSON 请求，并把 JSON 响应写到 `stdout`。

```bash
python3 python/midi2box.py --format json
```

可选导出格式：

```bash
python3 python/midi2box.py --format json < request.json
python3 python/midi2box.py --format svg < request.json
python3 python/midi2box.py --format pdf < request.json
```

CLI 从标准输入读取请求 JSON，并把响应 JSON 写到标准输出。

请求 JSON 格式：

```json
{
  "filename": "song.mid",
  "data_base64": "...",
  "options": {
    "quantize": 8,
    "autoMap": true,
    "minSpacingMm": 1,
    "tempoScale": 1,
    "title": "My Tape Title",
    "exportFontFamily": "Helvetica",
    "exportFontSize": 8,
    "exportShowPitch": true,
    "exportShowMeasures": true,
    "exportPaperSize": "A4",
    "exportTapeColumns": 2
  }
}
```

字段说明：

- `filename`：源 MIDI 文件名，仅用于摘要和导出标题
- `data_base64`：MIDI 文件二进制内容的 Base64 字符串
- `options.quantize`：节奏量化值，例如 `8` 表示 `1/8`
- `options.autoMap`：是否把超出音域的音符就近映射到可用音
- `options.minSpacingMm`：同一行连续孔位的最小间距检查阈值，单位 mm
- `options.tempoScale`：速度倍率，`1` 为原速，`2` 表示纸带长度约减半
- `options.title`：导出纸带标题；为空时使用 MIDI 文件名
- `options.exportFontFamily`：导出预览和 SVG 标题字体，支持 `Helvetica`、`Times`、`Courier`、`STSong-Light`
- `options.exportFontSize`：导出标注字号
- `options.exportShowPitch`：是否显示音高标注
- `options.exportShowMeasures`：是否显示小节/长度标记
- `options.exportPaperSize`：导出纸张大小，支持 `A3`、`A4`、`A5`、`Letter`、`Legal`；导出固定为纵向页面
- `options.exportTapeColumns`：并列纸带数；导出时会按纸面可容纳范围限制

从文件生成 JSON 结果：

```bash
python3 -c 'import base64,json,sys; p=sys.argv[1]; print(json.dumps({"filename":p,"data_base64":base64.b64encode(open(p,"rb").read()).decode(),"options":{"quantize":8,"autoMap":True,"minSpacingMm":1,"tempoScale":1}}))' song.mid \
  | python3 python/midi2box.py --format json
```

导出 SVG：

```bash
python3 -c 'import base64,json,sys; p=sys.argv[1]; print(json.dumps({"filename":p,"data_base64":base64.b64encode(open(p,"rb").read()).decode(),"options":{"quantize":8,"autoMap":True,"minSpacingMm":1,"tempoScale":1}}))' song.mid \
  | python3 python/midi2box.py --format svg
```

导出 PDF 文件：

```bash
python3 -c 'import base64,json,sys; p=sys.argv[1]; print(json.dumps({"filename":p,"data_base64":base64.b64encode(open(p,"rb").read()).decode(),"options":{"quantize":8,"autoMap":True,"minSpacingMm":1,"tempoScale":1}}))' song.mid \
  | python3 python/midi2box.py --format pdf \
  | python3 -c 'import base64,json,sys; sys.stdout.buffer.write(base64.b64decode(json.load(sys.stdin)["contentBase64"]))' \
  > midi2box-sheet.pdf
```

`svg` 响应中的 `content` 字段就是 SVG 文本；`pdf` 响应中的 `contentBase64` 字段是 PDF 文件内容的 Base64 编码。

## 打包

```bash
npm run tauri:build
```

当前实现默认调用系统 `python3`。如果本机 Python 命令不是 `python3`，可以指定：

```bash
PYTHON=/path/to/python npm run dev
```
