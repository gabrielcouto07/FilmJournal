import SwiftUI

#if os(iOS)
/// Envelope padrão do corpo de uma tela: aplica `.navigationTitle` + `fjTopBarStyle()` de uma vez.
public struct FJScreen<Content: View>: View {
    private let title: String
    private let displayMode: NavigationBarItem.TitleDisplayMode
    private let content: Content

    public init(
        _ title: String,
        displayMode: NavigationBarItem.TitleDisplayMode = .inline,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.displayMode = displayMode
        self.content = content()
    }

    public var body: some View {
        content
            .navigationTitle(title)
            .fjTopBarStyle(displayMode: displayMode)
    }
}
#endif
