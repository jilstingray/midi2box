import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import "./styles.css";

type NotePoint = {
  sourceName: string;
  name: string;
  pitch: number;
  row: number;
  time: number;
  xMm: number;
  velocity: number;
  mapped: boolean;
  spacingWarning?: boolean;
};

type ConversionResult = {
  filename: string;
  format: string;
  trackCount: number;
  ppq: number;
  durationSeconds: number;
  measureCount: number;
  paper: { low: string; high: string; lowPitch: number; highPitch: number; notes: number; widthMm: number; lengthMm: number; holeRadiusMm: number; mmPerSecond: number };
  options: Options;
  notes: NotePoint[];
  unmapped: { name: string; tick: number }[];
  spacingWarnings: { name: string; xMm: number }[];
};

type Options = {
  quantize: number;
  autoMap: boolean;
  minSpacingMm: number;
  tempoScale: number;
  title?: string;
  exportFontFamily?: string;
  exportFontSize?: number;
  exportShowPitch?: boolean;
  exportShowMeasures?: boolean;
  exportPaperSize?: string;
  exportTapeColumns?: number;
};

type MidiSelection = {
  name: string;
};

type Locale = "zh" | "en";
type ThemeMode = "light" | "dark" | "system";

const messages = {
  zh: {
    importMidi: "导入 MIDI",
    stop: "停止",
    playPreview: "播放",
    noFile: "未选择文件",
    exportPdf: "导出 PDF",
    exportSvg: "导出 SVG",
    exportMenu: "导出",
    exportPreview: "导出预览",
    tapeTitle: "纸带标题",
    paperSize: "纸张大小",
    tapeColumns: "并列纸带数",
    exportFont: "字体",
    exportFontSize: "字号",
    exportShowPitch: "显示音高",
    exportShowMeasures: "小节标记",
    fixedTapeWidth: "固定纸带宽度",
    closePreview: "关闭预览",
    pause: "暂停",
    resume: "继续",
    volume: "音量",
    transport: "播放控制",
    mapping: "音域映射",
    paperRange: "纸带音域",
    noteCount: "30 音",
    autoMap: "自动升/降调映射",
    quantize: "量化",
    quantizeValue: "量化值",
    minSpacing: "最小孔距 (mm)",
    speed: "速度",
    paperSpeed: "纸带速度",
    playbackSpeed: "播放速度",
    tapeVerticalWidth: "纸带纵向宽度",
    preview: "预览",
    holes: "个孔位",
    waitingMidi: "等待 MIDI 文件",
    converting: "正在转换 MIDI...",
    totalLength: "总长度",
    approx: "约",
    paperWidth: "纸带宽度",
    holeDiameter: "孔径",
    minSpacingMetric: "最小孔距",
    footer: "支持标准 MIDI 文件；导出 SVG 适合进一步排版或激光切割。",
    checks: "检查项",
    spacingRisk: "孔距过近",
    unmapped: "未映射",
    noIssues: "暂无孔距或映射问题",
    emptyTitle: "导入 MIDI 后生成 30 音纸带谱",
    emptyText: "支持 {range}，超出音域可自动按八度升/降调映射。",
    summary: "转换摘要",
    file: "文件",
    format: "格式",
    tracks: "轨道数",
    ppq: "分辨率",
    measures: "小节数",
    duration: "时长",
    unmappedNotes: "未映射音符",
    legend: "图例",
    mappedNote: "已映射音符",
    nearestMappedNote: "就近映射音符",
    paperGrid: "纸带网格",
    scaleTitle: "横向拖动调节显示比例",
    midiFileFilter: "MIDI 文件",
    chooseMidi: "选择 MIDI 文件",
    exportTitle: "导出 {format}",
    exported: "已导出：{path}",
    tauriRequired: "转换功能需要在 Tauri 桌面窗口中运行。请使用 npm run dev 启动桌面 GUI。",
    language: "语言",
    settings: "设置",
    toggleLeftPanel: "折叠/展开左侧菜单栏",
    toggleSummary: "显示/隐藏转换摘要",
    close: "关闭",
    backToApp: "返回应用",
    searchSettings: "搜索设置",
    general: "通用",
    preferences: "偏好设置",
    appearance: "外观",
    interfaceLanguage: "界面语言",
    theme: "主题",
    lightTheme: "浅色",
    darkTheme: "深色",
    systemTheme: "跟随系统",
    accentColor: "强调色",
    accentPreset: "预设色",
    lightTapeInDark: "深色模式下纸带用浅色显示",
    chinese: "中文",
    english: "English",
    mappedTo: "→",
  },
  en: {
    importMidi: "Import MIDI",
    stop: "Stop",
    playPreview: "Play",
    noFile: "No file selected",
    exportPdf: "Export PDF",
    exportSvg: "Export SVG",
    exportMenu: "Export",
    exportPreview: "Export Preview",
    tapeTitle: "Tape Title",
    paperSize: "Paper Size",
    tapeColumns: "Parallel Tapes",
    exportFont: "Font",
    exportFontSize: "Font Size",
    exportShowPitch: "Show Pitch",
    exportShowMeasures: "Measure Marks",
    fixedTapeWidth: "Fixed Tape Width",
    closePreview: "Close Preview",
    pause: "Pause",
    resume: "Resume",
    volume: "Volume",
    transport: "Transport",
    mapping: "Range Mapping",
    paperRange: "Paper Range",
    noteCount: "30 notes",
    autoMap: "Auto Octave Map",
    quantize: "Quantize",
    quantizeValue: "Quantize",
    minSpacing: "Min Spacing (mm)",
    speed: "Speed",
    paperSpeed: "Paper Speed",
    playbackSpeed: "Playback Speed",
    tapeVerticalWidth: "Tape Vertical Width",
    preview: "Preview",
    holes: "holes",
    waitingMidi: "Waiting for MIDI",
    converting: "Converting MIDI...",
    totalLength: "Total Length",
    approx: "approx.",
    paperWidth: "Paper Width",
    holeDiameter: "Hole Diameter",
    minSpacingMetric: "Min Spacing",
    footer: "Supports standard MIDI files; SVG export is suitable for layout work or laser cutting.",
    checks: "Checks",
    spacingRisk: "Too close",
    unmapped: "Unmapped",
    noIssues: "No spacing or mapping issues",
    emptyTitle: "Import a MIDI file to generate a 30-note paper strip",
    emptyText: "Supports {range}; out-of-range notes can be octave-shifted into the paper range.",
    summary: "Summary",
    file: "File",
    format: "Format",
    tracks: "Tracks",
    ppq: "PPQ",
    measures: "Measures",
    duration: "Duration",
    unmappedNotes: "Unmapped Notes",
    legend: "Legend",
    mappedNote: "Mapped note",
    nearestMappedNote: "Nearest mapped note",
    paperGrid: "Paper grid",
    scaleTitle: "Drag horizontally to adjust display scale",
    midiFileFilter: "MIDI Files",
    chooseMidi: "Choose MIDI File",
    exportTitle: "Export {format}",
    exported: "Exported: {path}",
    tauriRequired: "Conversion requires the Tauri desktop window. Start the desktop GUI with npm run dev.",
    language: "Language",
    settings: "Settings",
    toggleLeftPanel: "Toggle left sidebar",
    toggleSummary: "Show/hide summary",
    close: "Close",
    backToApp: "Back to app",
    searchSettings: "Search settings",
    general: "General",
    preferences: "Preferences",
    appearance: "Appearance",
    interfaceLanguage: "Interface Language",
    theme: "Theme",
    lightTheme: "Light",
    darkTheme: "Dark",
    systemTheme: "System",
    accentColor: "Accent Color",
    accentPreset: "Preset Colors",
    lightTapeInDark: "Use Light Tape in Dark Mode",
    chinese: "中文",
    english: "English",
    mappedTo: "to",
  },
} as const;

const app = document.querySelector<HTMLDivElement>("#app")!;
let midiFile: MidiSelection | null = null;
let midiBase64 = "";
let result: ConversionResult | null = null;
let options: Options = {
  quantize: 8,
  autoMap: true,
  minSpacingMm: 1,
  tempoScale: 1,
  exportFontFamily: "Helvetica",
  exportFontSize: 8,
  exportShowPitch: true,
  exportShowMeasures: true,
  exportPaperSize: "A4",
  exportTapeColumns: 2,
};
let busy = false;
let error = "";
let notice = "";
let isPlaying = false;
let isPaused = false;
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let previewTimer: number | null = null;
let progressFrame: number | null = null;
let playbackStartAt = 0;
let playbackOffsetSeconds = 0;
let playbackProgressSeconds = 0;
let previewRate = 1;
let previewPxPerMm = 5;
let previewRowH = readPreviewRowH();
let viewportWidth = window.innerWidth;
let scaleDragStartX: number | null = null;
let scaleDragStartPxPerMm = previewPxPerMm;
let scaleDragScrollRatio = 0;
let verticalScaleDragStartY: number | null = null;
let verticalScaleDragStartRowH = previewRowH;
let minSpacingConvertTimer: number | null = null;
let activeAudioNodes: AudioScheduledSourceNode[] = [];
let previewVolume = readPreviewVolume();
let settingsOpen = false;
let exportPreviewOpen = false;
let summaryOpen = viewportWidth > 1180;
let leftSidebarCollapsed = false;
const collapsedPanels = new Set<string>();
const DEFAULT_LOW_PITCH = 60;
const DEFAULT_NOTE_COUNT = 30;
let locale: Locale = readLocale();
let themeMode: ThemeMode = readThemeMode();
let accentColor = readAccentColor();
let lightTapeInDark = readLightTapeInDark();

function isLeftSidebarCollapsed() {
  return leftSidebarCollapsed;
}

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function resolvedTheme() {
  return themeMode === "system" ? (systemPrefersDark() ? "dark" : "light") : themeMode;
}

function applyAppearance() {
  const theme = resolvedTheme();
  const rgb = hexToRgb(accentColor);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.dataset.lightTapeInDark = String(lightTapeInDark);
  document.documentElement.style.colorScheme = theme;
  document.documentElement.style.setProperty("--accent", accentColor);
  document.documentElement.style.setProperty("--accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
}

function t(key: keyof typeof messages.zh, params: Record<string, string | number> = {}) {
  let text = messages[locale][key];
  for (const [name, value] of Object.entries(params)) {
    text = text.replace(`{${name}}`, String(value)) as typeof text;
  }
  return text;
}

function icon(name: string) {
  const paths: Record<string, string> = {
    folder: '<path d="M3 7h5l2 2h11v10H3z"/><path d="M3 7V5h5l2 2"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    rewind: '<path d="m11 19-8-7 8-7v14Z"/><path d="m21 19-8-7 8-7v14Z"/>',
    forward: '<path d="m13 5 8 7-8 7V5Z"/><path d="m3 5 8 7-8 7V5Z"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 9.5a4 4 0 0 1 0 5"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 3.46l-.15.1a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0-3.46l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? ""}</svg>`;
}

function render() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  applyAppearance();
  app.innerHTML = `
    <div class="shell">
      <aside class="controls-pane">
        ${panel(t("mapping"), "mapping", `
          <label>${t("paperRange")}<input value="${paperRange()} (${t("noteCount")})" disabled /></label>
          <label>${t("autoMap")}<span class="switch"><input id="autoMap" type="checkbox" ${options.autoMap ? "checked" : ""}/><i></i></span></label>
        `)}
        ${panel(t("quantize"), "quantize", `
          <label>${t("quantizeValue")}<select id="quantize">
            ${[4, 8, 12, 16, 24, 32].map((v) => `<option value="${v}" ${v === options.quantize ? "selected" : ""}>1/${v}</option>`).join("")}
          </select></label>
          <label>${t("minSpacing")}<input id="minSpacingMm" type="number" min="0.5" max="10" step="0.5" value="${options.minSpacingMm}" /></label>
        `)}
        ${panel(t("speed"), "speed", `
          <label>${t("paperSpeed")}<input id="tempoScale" type="range" min="0.5" max="2" step="0.05" value="${options.tempoScale}" /></label>
          <div class="scale-value" id="tempoScaleValue">${Math.round(options.tempoScale * 100)}%</div>
        `)}
        ${warnings()}
        ${legend()}
      </aside>
      <main class="app-content">
        <header class="topbar">
          ${renderTransport()}
          <div class="exports">
            <button id="importMidi" class="ghost">${icon("folder")}${t("importMidi")}</button>
            <button id="toggleSummary" class="icon-only ghost" aria-label="${t("toggleSummary")}" title="${t("toggleSummary")}">${icon("grid")}</button>
            <button id="exportButton" class="primary" ${!result ? "disabled" : ""}>${icon("download")}${t("exportMenu")}</button>
          </div>
        </header>
        <div class="workspace">
          <section class="preview">
            <div class="section-title"><h1>${t("preview")}</h1><span>${result ? `${result.notes.length} ${t("holes")}` : t("waitingMidi")}</span></div>
            ${error ? `<div class="error">${error}</div>` : ""}
            ${notice ? `<div class="notice">${notice}</div>` : ""}
            ${busy ? `<div class="empty">${t("converting")}</div>` : renderTape()}
          </section>
          ${summaryOpen ? `<aside class="summary-popover">${summary()}</aside>` : ""}
        </div>
        <footer class="statusbar">
          <div class="footer-left">
            <button id="openSettings" class="footer-settings" aria-label="${t("settings")}" title="${t("settings")}">${icon("settings")}</button>
            <span class="help-tooltip" tabindex="0" aria-label="${t("footer")}">?<b>${t("footer")}</b></span>
          </div>
          ${renderFooterMetrics()}
        </footer>
      </main>
      ${settingsOpen ? renderSettingsPage() : ""}
      ${exportPreviewOpen ? renderExportPreviewDialog() : ""}
    </div>
  `;
  bind();
}

function renderFooterMetrics() {
  return `<div class="footer-metrics">
    <span>${t("totalLength")}: ${result ? `${t("approx")} ${result.paper.lengthMm} mm` : "-"}</span>
    <span>${t("paperWidth")}: ${result ? `${result.paper.widthMm} mm` : "-"}</span>
    <span>${t("holeDiameter")}: ${result ? `${result.paper.holeRadiusMm * 2} mm` : "-"}</span>
    <span>${t("minSpacingMetric")}: ${options.minSpacingMm} mm</span>
  </div>`;
}

function renderTransport() {
  const current = currentPlaybackSeconds();
  const total = result?.durationSeconds ?? 0;
  return `<div class="transport" aria-label="${t("transport")}">
    <div class="transport-cluster transport-left">
      <button id="rewindAudio" class="transport-button" aria-label="Rewind" title="Rewind" ${!canPlayPreview() ? "disabled" : ""}>${icon("rewind")}</button>
      <button id="previewAudio" class="transport-play" aria-label="${isPlaying && !isPaused ? t("pause") : t("playPreview")}" title="${isPlaying && !isPaused ? t("pause") : t("playPreview")}" ${!canPlayPreview() ? "disabled" : ""}>${icon(isPlaying && !isPaused ? "pause" : "play")}</button>
      <button id="stopAudio" class="transport-button" aria-label="${t("stop")}" title="${t("stop")}" ${!isPlaying && !isPaused ? "disabled" : ""}>${icon("stop")}</button>
      <button id="forwardAudio" class="transport-button" aria-label="Forward" title="Forward" ${!canPlayPreview() ? "disabled" : ""}>${icon("forward")}</button>
    </div>
    <div class="transport-time"><strong>${formatClock(current)}</strong><span>${formatClock(total)}</span></div>
    <div class="transport-cluster transport-right">
      <div class="speed-segment" aria-label="${t("playbackSpeed")}">
        ${[0.5, 1, 2].map((rate) => `<button class="speed-button ${previewRate === rate ? "is-active" : ""}" data-preview-rate="${rate}" type="button">${rate}x</button>`).join("")}
      </div>
      <label class="transport-slider transport-volume" aria-label="${t("volume")}">${icon("volume")}<input id="previewVolume" type="range" min="0" max="1" step="0.01" value="${previewVolume}" /></label>
    </div>
  </div>`;
}

function renderSettingsPage() {
  return `<div class="settings-backdrop" role="presentation">
    <section class="settings-page" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
      <aside class="settings-nav">
        <button id="closeSettings" class="settings-back">${icon("back")}${t("backToApp")}</button>
        <label class="settings-search">${icon("search")}<input type="search" placeholder="${t("searchSettings")}" /></label>
        <button class="settings-nav-item is-active">${t("general")}</button>
      </aside>
      <div class="settings-content">
        <header>
          <h2 id="settingsTitle">${t("settings")}</h2>
        </header>
        <section class="settings-section">
          <h3>${t("preferences")}</h3>
          <label class="settings-row">${t("interfaceLanguage")}<select id="locale">
            <option value="zh" ${locale === "zh" ? "selected" : ""}>${t("chinese")}</option>
            <option value="en" ${locale === "en" ? "selected" : ""}>${t("english")}</option>
          </select></label>
        </section>
        <section class="settings-section">
          <h3>${t("appearance")}</h3>
          <label class="settings-row">${t("theme")}<select id="themeMode">
            <option value="light" ${themeMode === "light" ? "selected" : ""}>${t("lightTheme")}</option>
            <option value="dark" ${themeMode === "dark" ? "selected" : ""}>${t("darkTheme")}</option>
            <option value="system" ${themeMode === "system" ? "selected" : ""}>${t("systemTheme")}</option>
          </select></label>
          <label class="settings-row">${t("accentColor")}<input id="accentColor" type="color" value="${accentColor}" /></label>
          <div class="settings-row accent-row"><span>${t("accentPreset")}</span><div class="accent-presets">
            ${["#007aff", "#34c759", "#ff9500", "#ff3b30", "#af52de", "#5856d6"].map((color) => `<button class="accent-swatch ${accentColor === color ? "is-selected" : ""}" data-accent="${color}" style="--swatch:${color}" aria-label="${color}" title="${color}"></button>`).join("")}
          </div></div>
          <label class="settings-row">${t("lightTapeInDark")}<span class="switch"><input id="lightTapeInDark" type="checkbox" ${lightTapeInDark ? "checked" : ""}/><i></i></span></label>
        </section>
      </div>
    </section>
  </div>`;
}

function renderExportPreviewDialog() {
  const preview = exportPreview(true);
  return `<div class="modal-backdrop" role="presentation">
    <section class="export-dialog" role="dialog" aria-modal="true" aria-label="${t("exportMenu")}">
      <div class="export-dialog-body">
        <aside class="export-dialog-options">
          <label>${t("tapeTitle")}<input id="dialogTapeTitle" value="${escapeAttr(exportTitle())}" placeholder="${escapeAttr(defaultExportTitle())}" /></label>
          <label>${t("paperSize")}<select id="dialogExportPaperSize">
            ${["A3", "A4", "A5", "Letter", "Legal"].map((size) => `<option value="${size}" ${size === exportPaperSize() ? "selected" : ""}>${size}</option>`).join("")}
          </select></label>
          <label>${t("tapeColumns")}<input id="dialogExportTapeColumns" type="number" min="1" max="${maxTapeColumns()}" step="1" value="${exportTapeColumns()}" /></label>
          <label>${t("exportFont")}<select id="dialogExportFontFamily">
            ${["Helvetica", "Times", "Courier", "STSong-Light"].map((font) => `<option value="${font}" ${font === exportFontFamily() ? "selected" : ""}>${font}</option>`).join("")}
          </select></label>
          <label>${t("exportFontSize")}<input id="dialogExportFontSize" type="number" min="5" max="16" step="1" value="${exportFontSize()}" /></label>
          <label>${t("exportShowPitch")}<span class="switch"><input id="dialogExportShowPitch" type="checkbox" ${exportShowPitch() ? "checked" : ""}/><i></i></span></label>
          <label>${t("exportShowMeasures")}<span class="switch"><input id="dialogExportShowMeasures" type="checkbox" ${exportShowMeasures() ? "checked" : ""}/><i></i></span></label>
          <label>${t("fixedTapeWidth")}<input value="${result?.paper.widthMm ?? 70} mm" disabled /></label>
          <div class="export-dialog-actions">
            <button id="dialogExportSvg" class="outline" ${!result ? "disabled" : ""}>${t("exportSvg")}</button>
            <button id="dialogExportPdf" class="primary" ${!result ? "disabled" : ""}>${t("exportPdf")}</button>
          </div>
        </aside>
        <div class="export-dialog-preview">
          <button id="closeExportPreview" class="icon-only export-preview-close" aria-label="${t("closePreview")}" title="${t("closePreview")}">×</button>
          ${preview || `<div class="empty">${t("waitingMidi")}</div>`}
        </div>
      </div>
    </section>
  </div>`;
}

function panel(title: string, id: string, body: string) {
  const collapsed = collapsedPanels.has(id);
  return `<section class="panel ${collapsed ? "is-collapsed" : ""}">
    <button class="panel-title" data-panel-id="${id}" aria-expanded="${!collapsed}">${title}<span>⌃</span></button>
    <div class="panel-body" ${collapsed ? "hidden" : ""}>${body}</div>
  </section>`;
}

function warnings() {
  const count = (result?.unmapped.length ?? 0) + (result?.spacingWarnings.length ?? 0);
  if (count === 0) return "";
  const spacingItems = result?.spacingWarnings.slice(0, 4).map((n) => `<p>${t("spacingRisk")} ${n.name} @ ${n.xMm} mm</p>`).join("") ?? "";
  const unmappedItems = result?.unmapped.slice(0, 4).map((n) => `<p>${t("unmapped")} ${n.name}</p>`).join("") ?? "";
  return `<section class="warning">${icon("alert")}<strong>${t("checks")}</strong><b>${count}</b>
    <div>${spacingItems}${unmappedItems}</div>
  </section>`;
}

function renderTape() {
  if (!result) {
    return `<div class="empty">${icon("file")}<strong>${t("emptyTitle")}</strong><span>${t("emptyText", { range: paperRange() })}</span></div>`;
  }
  const converted = result;
  const width = tapePixelWidth(converted.paper.lengthMm);
  const rowH = previewRowH;
  const rowCount = converted.paper.notes;
  const height = rowH * rowCount;
  const labels = Array.from({ length: converted.paper.notes }, (_, i) => midiName(converted.paper.lowPitch + i));
  const playheadX = tapeXForProgress(width, converted, playbackProgressSeconds);
  const activeRows = activePlaybackRows();
  const holes = converted.notes.map((note) => {
    const x = 18 + (note.xMm / converted.paper.lengthMm) * (width - 36);
    const y = 20 + (rowCount - 1 - note.row) * rowH;
    const classes = ["hole", note.mapped ? "" : "remap", note.spacingWarning ? "spacing-risk" : ""].filter(Boolean).join(" ");
    const warning = note.spacingWarning ? `; ${t("spacingRisk")}` : "";
    return `<button class="${classes}" data-time="${note.time}" data-row="${note.row}" style="left:${x}px;top:${y}px" title="${note.sourceName} ${t("mappedTo")} ${note.name}${warning}"></button>`;
  }).join("");
  return `<div class="tape-preview-frame">${renderPitchAxis(rowH, rowCount, labels, activeRows)}<div class="tape-scroll"><div class="tape-content" style="width:${width}px">
      ${renderScaleRuler(width, converted.paper.lengthMm)}
      <div class="tape ${isPlaying ? "is-playing" : ""}" style="width:${width}px;height:${height + 42}px">
        <div class="grid-lines" style="background-size:${previewPxPerMm * 10}px ${rowH}px"></div>${holes}<div class="playhead ${isPlaying ? "is-playing" : ""}" style="transform:translateX(${playheadX}px)"></div>
      </div>
    </div></div></div>`;
}

function summary() {
  const rows = [
    [t("format"), result?.format ?? "-"],
    [t("tracks"), result?.trackCount ?? "-"],
    [t("ppq"), result?.ppq ?? "-"],
    [t("measures"), result?.measureCount ?? "-"],
    [t("duration"), result ? formatDuration(result.durationSeconds) : "-"],
    [t("paperRange"), paperRange()],
    [t("unmappedNotes"), result?.unmapped.length ?? 0],
  ];
  return `<section class="summary"><h2>${t("summary")}</h2>${rows.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join("")}</section>`;
}

function legend() {
  return `<section class="legend"><h2>${t("legend")}</h2><p><i class="dot"></i>${t("mappedNote")}</p><p><i class="dot warn"></i>${t("nearestMappedNote")}</p><p><i class="dot risk"></i>${t("spacingRisk")}</p><p><i class="line"></i>${t("paperGrid")}</p></section>`;
}

function exportPreview(large = false) {
  if (!result) return "";
  const page = exportPageSpec();
  const columns = exportTapeColumns();
  const segmentLength = exportSegmentLengthMm();
  const segments = Math.max(1, Math.ceil(result.paper.lengthMm / segmentLength));
  const visibleSegments = large ? segments : Math.min(Math.max(columns * 2, segments), 12);
  const pages = Math.max(1, Math.ceil(visibleSegments / columns));
  return `<section class="export-preview ${large ? "is-large" : ""}">
    <div class="a4-pages" style="--pdf-cols:${columns};--paper-ratio:${page.width / page.height};--export-font:${exportFontFamily()};--export-font-size:${exportFontSize()}px">
      ${Array.from({ length: pages }, (_, page) => renderA4Page(page, columns, visibleSegments, segmentLength)).join("")}
    </div>
  </section>`;
}

function renderA4Page(page: number, columns: number, visibleSegments: number, segmentLength: number) {
  return `<div class="a4-sheet">
    ${Array.from({ length: columns }, (_, column) => {
      const segmentIndex = page * columns + column;
      if (segmentIndex >= visibleSegments) return `<span class="a4-strip is-empty"></span>`;
      return renderPrintStrip(segmentIndex, segmentLength);
    }).join("")}
  </div>`;
}

function renderPrintStrip(segmentIndex: number, segmentLength: number) {
  if (!result) return "";
  const startMm = segmentIndex * segmentLength;
  const endMm = Math.min(result.paper.lengthMm, startMm + segmentLength);
  const segmentNotes = result.notes.filter((note) => note.xMm >= startMm && note.xMm <= endMm);
  const holes = segmentNotes.map((note) => {
    const lengthPos = ((note.xMm - startMm) / Math.max(endMm - startMm, 1)) * 100;
    const pitchPos = ((note.row + 0.5) / result!.paper.notes) * 100;
    const left = pitchPos;
    const top = lengthPos;
    const classes = ["print-hole", note.mapped ? "" : "remap", note.spacingWarning ? "spacing-risk" : ""].filter(Boolean).join(" ");
    return `<i class="${classes}" style="left:${left}%;top:${top}%"></i>`;
  }).join("");
  const measureMarks = exportShowMeasures() ? renderPrintMeasureMarks(startMm, endMm) : "";
  const pitchLabels = exportShowPitch() ? renderPrintPitchLabels() : "";
  return `<span class="a4-strip ${segmentIndex === 0 ? "first-strip" : ""}">
    ${segmentIndex === 0 ? `<strong>${escapeHtml(exportTitle())}</strong>` : ""}
    <small>${segmentIndex + 1}</small>
    ${pitchLabels}
    ${measureMarks}
    ${holes}
  </span>`;
}

function renderPrintMeasureMarks(startMm: number, endMm: number) {
  const marks = [];
  for (let mm = Math.ceil(startMm / 10) * 10; mm <= endMm; mm += 10) {
    const top = ((mm - startMm) / Math.max(endMm - startMm, 1)) * 100;
    const style = `top:${top}%`;
    marks.push(`<b class="print-measure ${mm % 50 === 0 ? "major" : ""}" style="${style}">${mm % 50 === 0 ? `<span>${mm}</span>` : ""}</b>`);
  }
  return marks.join("");
}

function renderPrintPitchLabels() {
  if (!result) return "";
  const anchors = [0, 5, 10, 15, 20, 25, result.paper.notes - 1];
  return anchors.map((row) => {
    const pos = ((row + 0.5) / result!.paper.notes) * 100;
    const style = `left:${pos}%`;
    return `<em class="print-pitch" style="${style}">${midiName(result!.paper.lowPitch + row)}</em>`;
  }).join("");
}

function renderScaleRuler(width: number, lengthMm: number) {
  const marks = [];
  for (let mm = 0; mm <= Math.floor(lengthMm); mm += 1) {
    const x = 18 + (mm / lengthMm) * (width - 36);
    const className = mm % 50 === 0 ? "major" : mm % 10 === 0 ? "medium" : "";
    marks.push(`<span class="scale-mark ${className}" style="left:${x}px"><i></i>${mm % 50 === 0 ? `<b>${mm}</b>` : ""}</span>`);
  }
  return `<div class="ruler" style="width:${width}px" title="${t("scaleTitle")}">${marks.join("")}</div>`;
}

function tapePixelWidth(lengthMm: number) {
  return Math.max(220, Math.ceil(lengthMm * previewPxPerMm + 36));
}

function startScaleDrag(event: PointerEvent) {
  scaleDragStartX = event.clientX;
  scaleDragStartPxPerMm = previewPxPerMm;
  const scroll = document.querySelector<HTMLDivElement>(".tape-scroll");
  scaleDragScrollRatio = scroll ? scroll.scrollLeft / Math.max(scroll.scrollWidth - scroll.clientWidth, 1) : 0;
  event.preventDefault();
  window.addEventListener("pointermove", handleScaleDrag);
  window.addEventListener("pointerup", stopScaleDrag, { once: true });
}

function handleScaleDrag(event: PointerEvent) {
  if (scaleDragStartX === null) return;
  const before = currentPlaybackSeconds();
  previewPxPerMm = clamp(scaleDragStartPxPerMm + (event.clientX - scaleDragStartX) * 0.025, 2, 12);
  render();
  updateTapeProgress(before);
  restoreTapeHorizontalScroll(scaleDragScrollRatio);
}

function stopScaleDrag() {
  scaleDragStartX = null;
  window.removeEventListener("pointermove", handleScaleDrag);
}

function renderPitchAxis(rowH: number, rowCount: number, labels: string[], activeRows: Set<number>) {
  const rows = labels.map((label, i) => {
    const y = 18 + (rowCount - 1 - i) * rowH;
    return `<span class="pitch-axis-label ${activeRows.has(i) ? "is-current" : ""}" data-row="${i}" style="top:${y}px">${label}</span>`;
  }).join("");
  return `<div class="pitch-axis" style="height:${rowH * rowCount + 42}px" title="${t("tapeVerticalWidth")}">
    ${rows}
  </div>`;
}

function restoreTapeHorizontalScroll(ratio: number) {
  const scroll = document.querySelector<HTMLDivElement>(".tape-scroll");
  if (!scroll) return;
  scroll.scrollLeft = Math.max(0, ratio) * Math.max(scroll.scrollWidth - scroll.clientWidth, 0);
}

function startVerticalScaleDrag(event: PointerEvent) {
  verticalScaleDragStartY = event.clientY;
  verticalScaleDragStartRowH = previewRowH;
  event.preventDefault();
  window.addEventListener("pointermove", handleVerticalScaleDrag);
  window.addEventListener("pointerup", stopVerticalScaleDrag, { once: true });
}

function handleVerticalScaleDrag(event: PointerEvent) {
  if (verticalScaleDragStartY === null) return;
  const before = currentPlaybackSeconds();
  previewRowH = clamp(Math.round(verticalScaleDragStartRowH + (event.clientY - verticalScaleDragStartY) * 0.08), 11, 24);
  localStorage.setItem("midi2box.previewRowH", String(previewRowH));
  render();
  updateTapeProgress(before);
}

function stopVerticalScaleDrag() {
  verticalScaleDragStartY = null;
  window.removeEventListener("pointermove", handleVerticalScaleDrag);
}

function handleTapeZoomWheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  const scroll = event.currentTarget as HTMLDivElement;
  const before = currentPlaybackSeconds();
  const pointerX = event.clientX - scroll.getBoundingClientRect().left;
  const scrollRatio = (scroll.scrollLeft + pointerX) / Math.max(scroll.scrollWidth, 1);
  const zoomFactor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  previewPxPerMm = clamp(previewPxPerMm * zoomFactor, 2, 12);
  render();
  updateTapeProgress(before);
  const nextScroll = document.querySelector<HTMLDivElement>(".tape-scroll");
  if (nextScroll) {
    nextScroll.scrollLeft = Math.max(0, scrollRatio * nextScroll.scrollWidth - pointerX);
  }
}

function bind() {
  document.querySelector("#toggleLeftSidebar")?.addEventListener("click", () => {
    leftSidebarCollapsed = !leftSidebarCollapsed;
    render();
  });
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>(".panel-title"))) {
    button.addEventListener("click", () => {
      const id = button.dataset.panelId;
      if (!id) return;
      if (collapsedPanels.has(id)) {
        collapsedPanels.delete(id);
      } else {
        collapsedPanels.add(id);
      }
      render();
    });
  }
  document.querySelector("#importMidi")?.addEventListener("click", () => void importMidi());
  document.querySelector("#openSettings")?.addEventListener("click", () => {
    settingsOpen = true;
    render();
  });
  document.querySelector("#closeSettings")?.addEventListener("click", () => {
    settingsOpen = false;
    render();
  });
  document.querySelector(".settings-backdrop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      settingsOpen = false;
      render();
    }
  });
  document.querySelector("#locale")?.addEventListener("change", (event) => {
    locale = (event.target as HTMLSelectElement).value === "en" ? "en" : "zh";
    localStorage.setItem("midi2box.locale", locale);
    void syncSystemMenuLocale();
    render();
  });
  document.querySelector("#themeMode")?.addEventListener("change", (event) => {
    const value = (event.target as HTMLSelectElement).value;
    themeMode = value === "dark" || value === "system" ? value : "light";
    localStorage.setItem("midi2box.themeMode", themeMode);
    render();
  });
  document.querySelector("#accentColor")?.addEventListener("input", (event) => {
    accentColor = normalizeHexColor((event.target as HTMLInputElement).value);
    localStorage.setItem("midi2box.accentColor", accentColor);
    applyAppearance();
  });
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>(".accent-swatch"))) {
    button.addEventListener("click", () => {
      accentColor = normalizeHexColor(button.dataset.accent ?? accentColor);
      localStorage.setItem("midi2box.accentColor", accentColor);
      render();
    });
  }
  document.querySelector("#lightTapeInDark")?.addEventListener("change", (event) => {
    lightTapeInDark = (event.target as HTMLInputElement).checked;
    localStorage.setItem("midi2box.lightTapeInDark", String(lightTapeInDark));
    applyAppearance();
  });
  document.querySelector("#previewAudio")?.addEventListener("click", () => {
    togglePlayback();
  });
  document.querySelector("#stopAudio")?.addEventListener("click", () => {
    stopPreview(true);
  });
  document.querySelector("#rewindAudio")?.addEventListener("click", () => {
    seekPreview(-5);
  });
  document.querySelector("#forwardAudio")?.addEventListener("click", () => {
    seekPreview(5);
  });
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>(".speed-button"))) {
    button.addEventListener("click", () => {
      updatePreviewRate(Number(button.dataset.previewRate ?? 1));
    });
  }
  document.querySelector("#autoMap")?.addEventListener("change", async (event) => {
    options.autoMap = (event.target as HTMLInputElement).checked;
    await convert();
  });
  document.querySelector("#quantize")?.addEventListener("change", async (event) => {
    options.quantize = Number((event.target as HTMLSelectElement).value);
    await convert();
  });
  document.querySelector("#minSpacingMm")?.addEventListener("input", (event) => {
    options.minSpacingMm = Number((event.target as HTMLInputElement).value);
    scheduleConvert();
  });
  document.querySelector("#tempoScale")?.addEventListener("input", async (event) => {
    options.tempoScale = Number((event.target as HTMLInputElement).value);
    updateScaleValue("#tempoScaleValue", options.tempoScale);
  });
  document.querySelector("#tempoScale")?.addEventListener("change", async () => {
    await convert();
  });
  document.querySelector("#previewVolume")?.addEventListener("input", (event) => {
    previewVolume = clamp(Number((event.target as HTMLInputElement).value), 0, 1);
    localStorage.setItem("midi2box.previewVolume", String(previewVolume));
    updateScaleValue("#previewVolumeValue", previewVolume);
    if (masterGain && audioContext) {
      masterGain.gain.setTargetAtTime(previewVolume * 0.36, audioContext.currentTime, 0.015);
    }
  });
  bindExportOptionControls("dialog");
  document.querySelector("#exportButton")?.addEventListener("click", () => {
    openExportPreview();
  });
  document.querySelector("#toggleSummary")?.addEventListener("click", () => {
    summaryOpen = !summaryOpen;
    render();
  });
  document.querySelector("#closeExportPreview")?.addEventListener("click", () => {
    exportPreviewOpen = false;
    render();
  });
  document.querySelector(".modal-backdrop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      exportPreviewOpen = false;
      render();
    }
  });
  document.querySelector(".ruler")?.addEventListener("pointerdown", (event) => {
    startScaleDrag(event as PointerEvent);
  });
  document.querySelector(".pitch-axis")?.addEventListener("pointerdown", (event) => {
    startVerticalScaleDrag(event as PointerEvent);
  });
  document.querySelector(".tape-scroll")?.addEventListener("wheel", (event) => {
    handleTapeZoomWheel(event as WheelEvent);
  });
  document.querySelector("#dialogExportSvg")?.addEventListener("click", () => exportFile("svg"));
  document.querySelector("#dialogExportPdf")?.addEventListener("click", () => exportFile("pdf"));
  document.querySelector(".tape")?.addEventListener("click", (event) => {
    if (!isPlaying) return;
    const seconds = secondsFromTapeClick(event as MouseEvent);
    if (seconds !== null) {
      void playPreview(seconds);
    }
  });
}

function togglePlayback() {
  if (!canPlayPreview() && !isPlaying && !isPaused) return;
  if (isPlaying && !isPaused) {
    pausePreview();
  } else {
    void playPreview(playbackProgressSeconds);
  }
}

function openExportPreview() {
  if (!result) return;
  exportPreviewOpen = true;
  render();
}

function bindExportOptionControls(prefix: "" | "dialog") {
  const id = (name: string) => `#${prefix}${prefix ? name[0].toUpperCase() + name.slice(1) : name}`;
  document.querySelector(id("tapeTitle"))?.addEventListener("input", (event) => {
    options.title = (event.target as HTMLInputElement).value;
    refreshExportPreviewInPlace();
  });
  document.querySelector(id("exportFontFamily"))?.addEventListener("change", (event) => {
    options.exportFontFamily = (event.target as HTMLSelectElement).value;
    render();
  });
  document.querySelector(id("exportPaperSize"))?.addEventListener("change", (event) => {
    options.exportPaperSize = (event.target as HTMLSelectElement).value;
    options.exportTapeColumns = exportTapeColumns();
    render();
  });
  document.querySelector(id("exportTapeColumns"))?.addEventListener("input", (event) => {
    options.exportTapeColumns = clamp(Math.round(Number((event.target as HTMLInputElement).value)), 1, maxTapeColumns());
    render();
  });
  document.querySelector(id("exportFontSize"))?.addEventListener("input", (event) => {
    options.exportFontSize = Number((event.target as HTMLInputElement).value);
    refreshExportPreviewInPlace();
  });
  document.querySelector(id("exportShowPitch"))?.addEventListener("change", (event) => {
    options.exportShowPitch = (event.target as HTMLInputElement).checked;
    render();
  });
  document.querySelector(id("exportShowMeasures"))?.addEventListener("change", (event) => {
    options.exportShowMeasures = (event.target as HTMLInputElement).checked;
    render();
  });
}

function refreshExportPreviewInPlace() {
  const pages = document.querySelector<HTMLElement>(".a4-pages");
  if (pages) {
    pages.style.setProperty("--export-font", exportFontFamily());
    pages.style.setProperty("--export-font-size", `${exportFontSize()}px`);
  }
  const title = document.querySelector<HTMLElement>(".a4-strip.first-strip strong");
  if (title) title.textContent = exportTitle();
}

async function importMidi() {
  stopPreview();
  error = "";
  notice = "";
  try {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: t("midiFileFilter"), extensions: ["mid", "midi"] }],
      title: t("chooseMidi"),
    });
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (typeof path !== "string") return;

    const response = await invoke<{ payload: { filename: string; dataBase64: string } }>("read_midi_file", { path });
    midiFile = { name: response.payload.filename || filenameFromPath(path) };
    midiBase64 = response.payload.dataBase64;
    await convert();
  } catch (err) {
    error = friendlyError(err);
    render();
  }
}

async function convert() {
  if (!midiFile || !midiBase64) return;
  stopPreview();
  busy = true;
  error = "";
  notice = "";
  render();
  try {
    const response = await invoke<{ payload: { result: ConversionResult } }>("convert_midi", {
      request: { filename: midiFile.name, data_base64: midiBase64, options },
    });
    result = response.payload.result;
  } catch (err) {
    error = friendlyError(err);
  } finally {
    busy = false;
    render();
  }
}

async function playPreview(startSeconds = 0) {
  if (!result || result.notes.length === 0) return;
  stopPreview(false);

  const context = getAudioContext();
  await context.resume();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-22, context.currentTime);
  compressor.knee.setValueAtTime(18, context.currentTime);
  compressor.ratio.setValueAtTime(5, context.currentTime);
  compressor.attack.setValueAtTime(0.006, context.currentTime);
  compressor.release.setValueAtTime(0.18, context.currentTime);

  const lowpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(5200, context.currentTime);
  lowpass.Q.setValueAtTime(0.45, context.currentTime);

  const master = context.createGain();
  master.gain.setValueAtTime(previewVolume * 0.36, context.currentTime);
  master.connect(compressor);
  compressor.connect(lowpass);
  lowpass.connect(context.destination);
  masterGain = master;

  const startAt = context.currentTime + 0.08;
  playbackStartAt = startAt;
  playbackOffsetSeconds = clamp(startSeconds, 0, result.durationSeconds);
  playbackProgressSeconds = playbackOffsetSeconds;
  for (const note of result.notes) {
    if (note.time + 0.001 < playbackOffsetSeconds) continue;
    const scheduledTime = startAt + (note.time - playbackOffsetSeconds) / previewRate;
    scheduleMusicBoxNote(context, master, midiToFrequency(note.pitch), scheduledTime, note.velocity / 127);
  }

  isPlaying = true;
  isPaused = false;
  const stopAfterMs = Math.max(800, ((result.durationSeconds - playbackOffsetSeconds) / previewRate + 2.2) * 1000);
  previewTimer = window.setTimeout(() => {
    stopPreview();
    render();
  }, stopAfterMs);
  render();
  startTapeFollow();
}

function stopPreview(shouldRender = false) {
  if (previewTimer !== null) {
    window.clearTimeout(previewTimer);
    previewTimer = null;
  }
  if (progressFrame !== null) {
    window.cancelAnimationFrame(progressFrame);
    progressFrame = null;
  }
  for (const node of activeAudioNodes) {
    try {
      node.stop();
    } catch {
      // Already stopped by the audio scheduler.
    }
  }
  activeAudioNodes = [];
  masterGain = null;
  isPlaying = false;
  isPaused = false;
  playbackStartAt = 0;
  playbackOffsetSeconds = 0;
  playbackProgressSeconds = 0;
  if (shouldRender) render();
}

function pausePreview() {
  if (!isPlaying || isPaused) return;
  const seconds = currentPlaybackSeconds();
  if (previewTimer !== null) {
    window.clearTimeout(previewTimer);
    previewTimer = null;
  }
  if (progressFrame !== null) {
    window.cancelAnimationFrame(progressFrame);
    progressFrame = null;
  }
  for (const node of activeAudioNodes) {
    try {
      node.stop();
    } catch {
      // Already stopped by the audio scheduler.
    }
  }
  activeAudioNodes = [];
  masterGain = null;
  playbackProgressSeconds = seconds;
  playbackOffsetSeconds = seconds;
  playbackStartAt = 0;
  isPlaying = true;
  isPaused = true;
  render();
  updateTapeProgress(seconds);
}

function getAudioContext() {
  audioContext ??= new AudioContext();
  return audioContext;
}

function scheduleMusicBoxNote(context: AudioContext, destination: AudioNode, frequency: number, startTime: number, velocity: number) {
  const duration = 1.65;
  const partials = [
    { ratio: 1, gain: 1, type: "sine" as OscillatorType },
    { ratio: 2, gain: 0.16, type: "triangle" as OscillatorType },
  ];

  for (const partial of partials) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = partial.type;
    oscillator.frequency.setValueAtTime(frequency * partial.ratio, startTime);

    const peak = Math.max(0.0001, velocity * partial.gain * 0.16);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(peak * 0.34, startTime + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.05);
    activeAudioNodes.push(oscillator);
  }
}

function startTapeFollow() {
  const tick = () => {
    if (!isPlaying || !audioContext || !result) return;
    playbackProgressSeconds = currentPlaybackSeconds();
    if (playbackProgressSeconds >= result.durationSeconds) {
      stopPreview();
      render();
      return;
    }
    updateTapeProgress(playbackProgressSeconds);
    progressFrame = window.requestAnimationFrame(tick);
  };
  updateTapeProgress(playbackOffsetSeconds);
  progressFrame = window.requestAnimationFrame(tick);
}

function updateTapeProgress(seconds: number) {
  if (!result) return;
  const tape = document.querySelector<HTMLDivElement>(".tape");
  const scroll = document.querySelector<HTMLDivElement>(".tape-scroll");
  const playhead = document.querySelector<HTMLDivElement>(".playhead");
  if (!tape || !scroll || !playhead) return;

  const x = tapeXForProgress(tape.clientWidth, result, seconds);
  playhead.style.transform = `translateX(${x}px)`;
  scroll.scrollLeft = Math.max(0, x - scroll.clientWidth * 0.42);

  for (const hole of Array.from(tape.querySelectorAll<HTMLButtonElement>(".hole"))) {
    const noteTime = Number(hole.dataset.time ?? -1);
    hole.classList.toggle("is-current", seconds >= noteTime && seconds - noteTime < 0.22);
  }

  const rows = activePlaybackRows(seconds);
  for (const label of Array.from(document.querySelectorAll<HTMLElement>(".pitch-axis-label"))) {
    label.classList.toggle("is-current", rows.has(Number(label.dataset.row)));
  }
  const time = document.querySelector<HTMLElement>(".transport-time strong");
  if (time) time.textContent = formatClock(seconds);
}

function activePlaybackRows(seconds = playbackProgressSeconds) {
  const rows = new Set<number>();
  if (!result || (!isPlaying && !isPaused)) return rows;
  for (const note of result.notes) {
    if (seconds >= note.time && seconds - note.time < 0.24) {
      rows.add(note.row);
    }
  }
  return rows;
}

function tapeXForProgress(width: number, converted: ConversionResult, seconds: number) {
  const xMm = xMmForSeconds(converted, seconds);
  return 18 + (xMm / converted.paper.lengthMm) * (width - 36);
}

function xMmForSeconds(converted: ConversionResult, seconds: number) {
  const clampedSeconds = clamp(seconds, 0, converted.durationSeconds);
  const exactNote = converted.notes.find((note) => Math.abs(note.time - clampedSeconds) < 0.0005);
  if (exactNote) return exactNote.xMm;
  return clampedSeconds * Math.max(converted.paper.mmPerSecond, 0.001);
}

function currentPlaybackSeconds() {
  if (!audioContext || playbackStartAt === 0) return playbackProgressSeconds;
  return Math.max(0, playbackOffsetSeconds + (audioContext.currentTime - playbackStartAt) * previewRate);
}

function secondsFromTapeClick(event: MouseEvent) {
  if (!result) return null;
  const tape = document.querySelector<HTMLDivElement>(".tape");
  if (!tape) return null;
  const rect = tape.getBoundingClientRect();
  const ratio = clamp((event.clientX - rect.left - 18) / Math.max(tape.clientWidth - 36, 1), 0, 1);
  const xMm = ratio * result.paper.lengthMm;
  return clamp(xMm / Math.max(result.paper.mmPerSecond, 0.001), 0, result.durationSeconds);
}

function updatePreviewRate(nextRate: number) {
  const wasPlaying = isPlaying;
  const seekTo = wasPlaying ? currentPlaybackSeconds() : playbackProgressSeconds;
  previewRate = clamp(nextRate, 0.5, 2);
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>(".speed-button"))) {
    button.classList.toggle("is-active", Number(button.dataset.previewRate ?? 1) === previewRate);
  }
  if (wasPlaying) {
    void playPreview(seekTo);
  }
}

function seekPreview(deltaSeconds: number) {
  if (!result) return;
  const next = clamp(currentPlaybackSeconds() + deltaSeconds, 0, result.durationSeconds);
  playbackProgressSeconds = next;
  if (isPlaying && !isPaused) {
    void playPreview(next);
  } else {
    updateTapeProgress(next);
    render();
  }
}

function updateScaleValue(selector: string, value: number, suffix = "%") {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return;
  element.textContent = suffix === "%" ? `${Math.round(value * 100)}%` : `${Math.round(value)}${suffix}`;
}

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const wholeSeconds = Math.floor(safe % 60).toString().padStart(2, "0");
  const hundredths = Math.floor((safe % 1) * 100).toString().padStart(2, "0");
  return `${minutes}:${wholeSeconds}.${hundredths}`;
}

function exportTitle() {
  const value = options.title?.trim();
  return value || defaultExportTitle();
}

function defaultExportTitle() {
  return (midiFile?.name ?? result?.filename ?? "MIDI2Box")
    .replace(/\.[^.\\/]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim() || "MIDI2Box";
}

function exportFontFamily() {
  const value = options.exportFontFamily;
  return value === "Times" || value === "Courier" || value === "STSong-Light" ? value : "Helvetica";
}

function exportFontSize() {
  return clamp(Math.round(Number(options.exportFontSize ?? 8)), 5, 16);
}

function exportShowPitch() {
  return options.exportShowPitch !== false;
}

function exportShowMeasures() {
  return options.exportShowMeasures !== false;
}

function exportPaperSize() {
  return ["A3", "A4", "A5", "Letter", "Legal"].includes(options.exportPaperSize ?? "") ? options.exportPaperSize! : "A4";
}

function exportTapeColumns() {
  return clamp(Math.round(Number(options.exportTapeColumns ?? Math.min(2, maxTapeColumns()))), 1, maxTapeColumns());
}

function maxTapeColumns() {
  const page = exportPageSpec();
  const across = page.width;
  return Math.max(1, Math.floor((across - 20 + 5) / (70 + 5)));
}

function exportPageSpec() {
  const sizes: Record<string, { width: number; height: number }> = {
    A3: { width: 297, height: 420 },
    A4: { width: 210, height: 297 },
    A5: { width: 148, height: 210 },
    Letter: { width: 216, height: 279 },
    Legal: { width: 216, height: 356 },
  };
  const base = sizes[exportPaperSize()] ?? sizes.A4;
  return base;
}

function exportSegmentLengthMm() {
  const page = exportPageSpec();
  const along = page.height;
  return Math.max(40, along - 25);
}

function scheduleConvert() {
  if (minSpacingConvertTimer !== null) window.clearTimeout(minSpacingConvertTimer);
  minSpacingConvertTimer = window.setTimeout(() => {
    minSpacingConvertTimer = null;
    void convert();
  }, 250);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function canPlayPreview() {
  return Boolean(result && result.notes.length > 0 && !busy);
}

function midiToFrequency(pitch: number) {
  return 440 * 2 ** ((pitch - 69) / 12);
}

async function exportFile(format: "svg" | "pdf") {
  if (!midiFile || !midiBase64) return;
  error = "";
  notice = "";
  try {
    const outputPath = await save({
      defaultPath: defaultExportFilename(format),
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
      title: t("exportTitle", { format: format.toUpperCase() }),
    });
    if (typeof outputPath !== "string") return;

    const response = await invoke<{ payload: { filename: string; path: string } }>("export_sheet_to_path", {
      request: { filename: midiFile.name, data_base64: midiBase64, options },
      format,
      outputPath,
    });
    notice = t("exported", { path: response.payload.path });
  } catch (err) {
    error = friendlyError(err);
  } finally {
    render();
  }
}

function defaultExportFilename(format: "svg" | "pdf") {
  const basename = (midiFile?.name ?? "midi2box-sheet")
    .replace(/\.[^.\\/]+$/, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  return `${basename || "midi2box-sheet"}.${format}`;
}

function friendlyError(err: unknown) {
  const message = String(err);
  if (message.includes("invoke") || message.includes("__TAURI__")) {
    return t("tauriRequired");
  }
  return message;
}

function readLocale(): Locale {
  return localStorage.getItem("midi2box.locale") === "en" ? "en" : "zh";
}

function readThemeMode(): ThemeMode {
  const value = localStorage.getItem("midi2box.themeMode");
  return value === "dark" || value === "system" ? value : "light";
}

function readAccentColor() {
  return normalizeHexColor(localStorage.getItem("midi2box.accentColor") ?? "#007aff");
}

function readLightTapeInDark() {
  return localStorage.getItem("midi2box.lightTapeInDark") !== "false";
}

function readPreviewRowH() {
  return clamp(Number(localStorage.getItem("midi2box.previewRowH") ?? 15), 11, 24);
}

function readPreviewVolume() {
  return clamp(Number(localStorage.getItem("midi2box.previewVolume") ?? 0.78), 0, 1);
}

function normalizeHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "#007aff";
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex);
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

function escapeAttr(value: string) {
  return escapeHtml(value);
}

function midiName(pitch: number) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

function filenameFromPath(path: string) {
  return path.split(/[\\/]/).pop() || "untitled.mid";
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function paperRange() {
  if (result) return `${result.paper.low} - ${result.paper.high}`;
  return `${midiName(DEFAULT_LOW_PITCH)} - ${midiName(DEFAULT_LOW_PITCH + DEFAULT_NOTE_COUNT - 1)}`;
}

window.addEventListener("resize", () => {
  const nextWidth = window.innerWidth;
  const nextSummaryOpen = nextWidth > 1180 && summaryOpen;
  const shouldRender = summaryOpen !== nextSummaryOpen;
  viewportWidth = nextWidth;
  summaryOpen = nextSummaryOpen;
  if (shouldRender) {
    render();
  }
});

window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (themeMode === "system") {
    applyAppearance();
  }
});

render();
void setupMenuEvents();
void syncSystemMenuLocale();

async function setupMenuEvents() {
  try {
    await listen("open-settings", () => {
      settingsOpen = true;
      render();
    });
    await listen("import-midi", () => {
      void importMidi();
    });
    await listen("export-sheet", () => {
      openExportPreview();
    });
    await listen("play-pause", () => {
      togglePlayback();
    });
    await listen("stop-playback", () => {
      stopPreview(true);
    });
    await listen("rewind-playback", () => {
      seekPreview(-5);
    });
    await listen("forward-playback", () => {
      seekPreview(5);
    });
  } catch {
    // Browser-only dev mode has no Tauri event bridge.
  }
}

async function syncSystemMenuLocale() {
  try {
    await invoke("set_app_locale", { locale });
  } catch {
    // Browser-only dev mode has no Tauri command bridge.
  }
}
