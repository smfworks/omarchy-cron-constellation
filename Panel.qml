import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "ConstellationLogic.js" as Sky

Panel {
  id: root
  moduleName: "smf.cron-constellation"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property var snapshot: Sky.demoSnapshot()
  property var runs: []
  property var stars: Sky.demoStars()

  readonly property string probeScript: {
    var u = Qt.resolvedUrl("probe.py").toString()
    if (u.indexOf("file://") === 0)
      return decodeURIComponent(u.substring(7))
    return u
  }
  readonly property string timeZone: Sky.detectTz()
  readonly property bool hermesPresent: snapshot && snapshot.present === true
  readonly property bool demo: Sky.barMode(snapshot) === "demo"
  readonly property string barLabel: Sky.barLabel(snapshot)
  readonly property bool showFailChip: Sky.showFailChip(snapshot)
  readonly property bool showRunChip: Sky.showRunChip(snapshot)
  readonly property int failCount: Sky.failCount(snapshot)
  readonly property int runCount: Sky.runningCount(snapshot)
  readonly property string statusLine: Sky.statusLine(snapshot)
  readonly property string summaryText: Sky.summaryLine(snapshot)
  readonly property string windowText: Sky.windowLine(snapshot)
  readonly property string headerPrimary: Sky.headerCaption(snapshot)
  readonly property string emptyCopy: Sky.emptyNightCopy(snapshot)
  readonly property string headerTone: Sky.headerTone(snapshot)
  readonly property color summaryPaint: headerTone === "fail"
    ? starFail
    : (headerTone === "err" || headerTone === "unknown"
      ? dim
      : (headerTone === "run" ? glow : starOk))
  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property color dim: Qt.darker(foreground, 1.55)
  readonly property color starOk: Color.accent
  readonly property color starFail: (bar && bar.urgent) ? bar.urgent : Color.urgent
  readonly property color glow: Color.accent
  readonly property color glass: Color.popups && Color.popups.background ? Color.popups.background : Color.background
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  function open() {
    setCenterHoverRevealSuppressed(false)
    root.controller.show()
    root.refresh()
  }

  function close() {
    setCenterHoverRevealSuppressed(false)
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) {
      root.close()
      return
    }
    setCenterHoverRevealSuppressed(true)
    root.controller.show()
    root.refresh()
  }

  function closeForPopoutSwitch() {
    setCenterHoverRevealSuppressed(false)
    root.controller.hide()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.hostWidget || root, direction)
    return false
  }

  function setCenterHoverRevealSuppressed(value) {
    if (root.bar && "centerHoverRevealSuppressed" in root.bar)
      root.bar.centerHoverRevealSuppressed = value
  }

  function refresh() {
    if (probe.running) {
      if (root.snapshot && root.snapshot.present === true && root.snapshot.stale !== true)
        root.applyStale("probe still running")
      return
    }
    probe.running = true
  }

  function applyStale(message) {
    var next = Sky.markStale(root.snapshot, message || "probe failed")
    root.snapshot = next
    root.runs = next && next.present === true ? (next.runs || []) : []
    root.stars = Sky.starsFromSnapshot(next)
  }

  function applyProbe(text) {
    var next = Sky.mergeProbe(root.snapshot, text)
    root.snapshot = next
    root.runs = next && next.present === true ? (next.runs || []) : []
    root.stars = Sky.starsFromSnapshot(next)
  }

  function glassFill(alpha) {
    return Qt.rgba(glass.r, glass.g, glass.b, alpha)
  }

  function accentFill(color, alpha) {
    return Qt.rgba(color.r, color.g, color.b, alpha)
  }

  function statusColor(run) {
    var kind = Sky.starKind(run && run.status)
    if (kind === "ok") return root.starOk
    if (kind === "run") return root.glow
    if (kind === "fail") return root.starFail
    return root.dim
  }


  Process {
    id: probe
    command: root.timeZone !== ""
      ? ["python3", root.probeScript, "--tz", root.timeZone]
      : ["python3", root.probeScript]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyProbe(text)
    }
    onExited: function(code) {
      if (code !== 0)
        root.applyProbe("")
    }
  }

  Timer {
    interval: Sky.POLL_MS
    running: true
    repeat: true
    onTriggered: root.refresh()
  }

  Component.onCompleted: root.refresh()

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.hostWidget || root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(440))
    contentHeight: panel.fittedContentHeight(body.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(t) {
        if (t === "r" || t === "R") root.refresh()
      }

      Column {
        id: body
        width: parent.width
        spacing: Style.space(12)
        leftPadding: Style.space(16)
        rightPadding: Style.space(16)
        topPadding: Style.space(14)
        bottomPadding: Style.space(14)

        Rectangle {
          id: headerCard
          width: parent.width - Style.space(32)
          implicitHeight: headerColumn.implicitHeight + Style.space(18)
          radius: Style.cornerRadius
          color: root.accentFill(root.glow, 0.08)
          border.width: 1
          border.color: root.accentFill(root.glow, 0.35)

          Column {
            id: headerColumn
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            anchors.leftMargin: Style.space(12)
            anchors.rightMargin: Style.space(12)
            spacing: Style.space(4)

            Text {
              text: "CRON CONSTELLATION"
              color: root.glow
              font.family: root.fontFamily
              font.pixelSize: Style.font.heading
              font.bold: true
              font.letterSpacing: 2.4
            }

            Text {
              width: parent.width
              wrapMode: Text.WordWrap
              text: root.headerPrimary
              color: root.dim
              font.family: root.fontFamily
              font.pixelSize: Style.font.body
            }

            Text {
              width: parent.width
              wrapMode: Text.WordWrap
              visible: root.hermesPresent && root.summaryText !== ""
              text: root.summaryText
              color: root.summaryPaint
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
            }
          }
        }

        Text {
          width: parent.width - Style.space(32)
          visible: root.demo
          wrapMode: Text.WordWrap
          text: "DEMO. The bar stays labeled DEMO until Cron Constellation opens real cron storage (cron/ or state.db). A lone .env or config.yaml is not a home. Dim demo stars are not last night. USD is shown only when Hermes stored a cost — estimates never size the sky."
          color: root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }

        Repeater {
          model: root.runs

          delegate: Rectangle {
            required property var modelData
            width: body.width - Style.space(32)
            implicitHeight: rowColumn.implicitHeight + Style.space(14)
            radius: Style.cornerRadius
            color: root.glassFill(0.42)
            border.width: 1
            border.color: root.accentFill(root.statusColor(modelData), 0.4)

            Rectangle {
              width: Style.space(3)
              radius: width / 2
              anchors.left: parent.left
              anchors.top: parent.top
              anchors.bottom: parent.bottom
              anchors.margins: Style.space(6)
              color: root.statusColor(modelData)
            }

            Column {
              id: rowColumn
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              anchors.leftMargin: Style.space(16)
              anchors.rightMargin: Style.space(12)
              spacing: Style.space(2)

              Row {
                width: parent.width
                spacing: Style.space(8)

                Text {
                  width: parent.width - metaLabel.implicitWidth - Style.space(8)
                  elide: Text.ElideRight
                  text: Sky.runHeading(modelData, root.snapshot && root.snapshot.profileCount)
                  color: root.foreground
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.subtitle
                  font.bold: true
                }

                Text {
                  id: metaLabel
                  text: Sky.runStatus(modelData)
                  color: root.statusColor(modelData)
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                  font.bold: true
                }
              }

              Text {
                width: parent.width
                wrapMode: Text.WordWrap
                text: Sky.runMeta(modelData)
                color: root.dim
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
              }

              Text {
                width: parent.width
                visible: !!(modelData && modelData.error)
                wrapMode: Text.WordWrap
                elide: Text.ElideRight
                text: modelData && modelData.error ? String(modelData.error) : ""
                color: root.starFail
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
              }
            }
          }
        }

        Text {
          visible: root.emptyCopy !== ""
          text: root.emptyCopy
          color: root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
        }

        Text {
          text: "Click the starfield to close · R refresh · Esc close"
          color: root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
        }
      }
    }
  }
}
