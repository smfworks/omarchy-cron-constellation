import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "ConstellationLogic.js" as Sky

BarWidget {
  id: root
  moduleName: "smf.cron-constellation"

  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false

  readonly property string skyTooltip: panelLoader.item && panelLoader.item.statusLine
    ? panelLoader.item.statusLine
    : "Cron Constellation"
  readonly property string skyBarLabel: panelLoader.item ? String(panelLoader.item.barLabel || "") : "DEMO"
  readonly property var skyStars: panelLoader.item && panelLoader.item.stars
    ? panelLoader.item.stars
    : Sky.demoStars()
  readonly property bool skyFailChip: panelLoader.item ? panelLoader.item.showFailChip === true : false
  readonly property bool skyRunChip: panelLoader.item ? panelLoader.item.showRunChip === true : false
  readonly property int skyFailCount: panelLoader.item ? Number(panelLoader.item.failCount || 0) : 0
  readonly property int skyRunCount: panelLoader.item ? Number(panelLoader.item.runCount || 0) : 0
  readonly property bool skyMuted: skyBarLabel !== ""

  readonly property color starOk: Color.accent
  readonly property color starFail: (bar && bar.urgent) ? bar.urgent : Color.urgent
  readonly property color starRun: Color.accent
  readonly property color starDim: bar ? bar.foreground : Color.foreground
  readonly property color skyForeground: bar ? bar.foreground : Color.foreground

  property real skyPhase: 0

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function toggle() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function togglePanel() {
    root.toggle()
  }

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
  }

  function cssColor(c, a) {
    return "rgba("
      + Math.round(c.r * 255) + ","
      + Math.round(c.g * 255) + ","
      + Math.round(c.b * 255) + ","
      + a + ")"
  }

  function paintSky(canvas) {
    var ctx = canvas.getContext("2d")
    if (!ctx) return
    var w = canvas.width
    var h = canvas.height
    ctx.reset()
    ctx.clearRect(0, 0, w, h)
    if (w < 2 || h < 2) return

    var stars = root.skyStars && root.skyStars.length ? root.skyStars : Sky.demoStars()
    var muted = root.skyMuted
    var t = root.skyPhase
    var span = Math.min(w, h)
    var i

    function kindColor(kind) {
      if (kind === "ok") return root.starOk
      if (kind === "fail") return root.starFail
      if (kind === "run") return root.starRun
      return root.starDim
    }

    for (i = 0; i < stars.length; i++) {
      var star = stars[i]
      var kind = star.kind || "dim"
      var color = kindColor(kind)
      var pulse = 0.55 + 0.45 * Math.sin(t * 1.4 + (star.twinkle || 0) * 6.2)
      var alpha = muted ? 0.18 + pulse * 0.16 : (kind === "dim" ? 0.22 + pulse * 0.18 : 0.42 + pulse * 0.48)
      var radius = Math.max(1.1, span * 0.055 * (star.size || Sky.EQUAL_SIZE))
      var x = (star.x || 0.5) * w
      var y = (star.y || 0.5) * h
      var glow = radius * (kind === "dim" ? 2.1 : 3.4)

      ctx.beginPath()
      ctx.fillStyle = root.cssColor(color, muted ? 0.06 : (kind === "fail" ? 0.18 : 0.12))
      ctx.arc(x, y, glow, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.fillStyle = root.cssColor(color, alpha)
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.fillStyle = root.cssColor(color, muted ? 0.12 : 0.32)
      ctx.arc(x, y, Math.max(0.6, radius * 0.32), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  IpcHandler {
    enabled: true
    target: "smf.cron-constellation"
    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.toggle() }
    function refresh(): void {
      if (panelLoader.item && panelLoader.item.refresh) panelLoader.item.refresh()
    }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "CC"
    labelVisible: false
    keepSpace: true
    active: root.opened
    tooltipText: root.skyTooltip
    fixedWidth: vertical ? barSize : Style.space(78)
    fixedHeight: vertical ? Style.space(78) : barSize
    onPressed: function(buttonCode) {
      if (buttonCode === Qt.LeftButton) root.toggle()
      else if (buttonCode === Qt.MiddleButton && panelLoader.item && panelLoader.item.refresh)
        panelLoader.item.refresh()
    }

    Canvas {
      id: sky
      z: 1
      anchors.fill: parent
      anchors.leftMargin: Style.spaceReal(5)
      anchors.rightMargin: Style.spaceReal(5)
      anchors.topMargin: Style.spaceReal(3)
      anchors.bottomMargin: Style.spaceReal(3)
      renderStrategy: Canvas.Cooperative
      onPaint: root.paintSky(sky)
    }

    Text {
      z: 2
      anchors.centerIn: parent
      visible: root.skyBarLabel !== ""
      text: root.skyBarLabel
      color: root.skyForeground
      font.family: bar ? bar.fontFamily : Style.font.family
      font.pixelSize: Style.font.caption
      font.bold: true
      font.letterSpacing: 1.2
    }

    Rectangle {
      z: 3
      visible: root.skyFailChip
      anchors.right: parent.right
      anchors.top: parent.top
      anchors.rightMargin: Style.space(4)
      anchors.topMargin: Style.space(3)
      width: chipLabel.implicitWidth + Style.space(8)
      height: chipLabel.implicitHeight + Style.space(2)
      radius: height / 2
      color: Qt.rgba(root.starFail.r, root.starFail.g, root.starFail.b, 0.88)

      Text {
        id: chipLabel
        anchors.centerIn: parent
        text: String(root.skyFailCount)
        color: root.skyForeground
        font.family: bar ? bar.fontFamily : Style.font.family
        font.pixelSize: Style.font.caption
        font.bold: true
      }
    }

    Rectangle {
      z: 3
      visible: root.skyRunChip
      anchors.left: parent.left
      anchors.top: parent.top
      anchors.leftMargin: Style.space(4)
      anchors.topMargin: Style.space(3)
      width: runChipLabel.implicitWidth + Style.space(8)
      height: runChipLabel.implicitHeight + Style.space(2)
      radius: height / 2
      color: Qt.rgba(root.starRun.r, root.starRun.g, root.starRun.b, 0.88)

      Text {
        id: runChipLabel
        anchors.centerIn: parent
        text: String(root.skyRunCount)
        color: root.skyForeground
        font.family: bar ? bar.fontFamily : Style.font.family
        font.pixelSize: Style.font.caption
        font.bold: true
      }
    }
  }

  Timer {
    interval: Sky.FRAME_MS
    running: true
    repeat: true
    onTriggered: {
      root.skyPhase = Date.now() / 1000
      sky.requestPaint()
    }
  }
}
