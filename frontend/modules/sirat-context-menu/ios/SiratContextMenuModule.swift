// NEEDS NATIVE BUILD: native hold menu for chat answers
import ExpoModulesCore
import UIKit

public class SiratContextMenuModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SiratContextMenu")

    View(SiratContextMenuView.self) {
      Events("onCopy", "onReport")

      Prop("canReport") { (view: SiratContextMenuView, canReport: Bool) in
        view.canReport = canReport
      }
    }
  }
}

// RN lays this view and its children out as usual; UIKit only adds the lift and the menu, so the row never resizes.
public final class SiratContextMenuView: ExpoView, UIContextMenuInteractionDelegate {
  let onCopy = EventDispatcher()
  let onReport = EventDispatcher()
  var canReport = false

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    addInteraction(UIContextMenuInteraction(delegate: self))
  }

  public func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    configurationForMenuAtLocation location: CGPoint
  ) -> UIContextMenuConfiguration? {
    UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { [weak self] _ in
      guard let self else { return nil }
      var actions = [
        UIAction(title: "Copy", image: UIImage(systemName: "doc.on.doc")) { [weak self] _ in self?.onCopy() }
      ]
      if self.canReport {
        actions.append(
          UIAction(title: "Report", image: UIImage(systemName: "flag"), attributes: .destructive) { [weak self] _ in
            self?.onReport()
          })
      }
      return UIMenu(children: actions)
    }
  }

  public func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    configuration: UIContextMenuConfiguration,
    highlightPreviewForItemWithIdentifier identifier: any NSCopying
  ) -> UITargetedPreview? {
    bubblePreview()
  }

  public func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    configuration: UIContextMenuConfiguration,
    dismissalPreviewForItemWithIdentifier identifier: any NSCopying
  ) -> UITargetedPreview? {
    bubblePreview()
  }

  // A hold that opens the menu must not also end as a press on a number tag inside the answer, so RN's touch handler drops the touch.
  public func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    willDisplayMenuFor configuration: UIContextMenuConfiguration,
    animator: (any UIContextMenuInteractionAnimating)?
  ) {
    var view = superview
    while let current = view {
      for recognizer in current.gestureRecognizers ?? [] where NSStringFromClass(type(of: recognizer)).contains("TouchHandler") {
        recognizer.isEnabled = false
        recognizer.isEnabled = true
      }
      view = current.superview
    }
  }

  private func bubblePreview() -> UITargetedPreview? {
    guard window != nil else { return nil }
    let parameters = UIPreviewParameters()
    parameters.backgroundColor = .clear
    parameters.visiblePath = bubblePath()
    return UITargetedPreview(view: self, parameters: parameters)
  }

  // Matches the answer bubble in ChatBubble.tsx: 20pt corners, with the 6pt tail corner bottom left.
  private func bubblePath() -> UIBezierPath {
    let b = bounds
    let r = min(20, b.width / 2, b.height / 2)
    let tail = min(6, r)
    let path = UIBezierPath()
    path.move(to: CGPoint(x: b.minX + r, y: b.minY))
    path.addLine(to: CGPoint(x: b.maxX - r, y: b.minY))
    path.addArc(withCenter: CGPoint(x: b.maxX - r, y: b.minY + r), radius: r, startAngle: -.pi / 2, endAngle: 0, clockwise: true)
    path.addLine(to: CGPoint(x: b.maxX, y: b.maxY - r))
    path.addArc(withCenter: CGPoint(x: b.maxX - r, y: b.maxY - r), radius: r, startAngle: 0, endAngle: .pi / 2, clockwise: true)
    path.addLine(to: CGPoint(x: b.minX + tail, y: b.maxY))
    path.addArc(withCenter: CGPoint(x: b.minX + tail, y: b.maxY - tail), radius: tail, startAngle: .pi / 2, endAngle: .pi, clockwise: true)
    path.addLine(to: CGPoint(x: b.minX, y: b.minY + r))
    path.addArc(withCenter: CGPoint(x: b.minX + r, y: b.minY + r), radius: r, startAngle: .pi, endAngle: .pi * 3 / 2, clockwise: true)
    path.close()
    return path
  }
}
