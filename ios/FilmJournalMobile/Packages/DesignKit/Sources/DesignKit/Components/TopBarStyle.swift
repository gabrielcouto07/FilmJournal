import SwiftUI

#if os(iOS)
import UIKit

public extension View {
    func fjTopBarStyle(displayMode: NavigationBarItem.TitleDisplayMode = .inline) -> some View {
        self.navigationBarTitleDisplayMode(displayMode)
    }
}

public enum FJTopBarAppearance {
    public static func install() {
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Color.fjCanvas.opacity(0.82))
        appearance.shadowColor = UIColor(Color.fjLine)
        appearance.titleTextAttributes = [.foregroundColor: UIColor(Color.fjText)]
        appearance.largeTitleTextAttributes = [.foregroundColor: UIColor(Color.fjText)]

        let bar = UINavigationBar.appearance()
        bar.standardAppearance = appearance
        bar.scrollEdgeAppearance = appearance
        bar.compactAppearance = appearance
        bar.compactScrollEdgeAppearance = appearance
        bar.tintColor = UIColor(Color.fjAccent)
    }
}
#else
public extension View {
    func fjTopBarStyle() -> some View { self }
}

public enum FJTopBarAppearance {
    public static func install() {}
}
#endif
