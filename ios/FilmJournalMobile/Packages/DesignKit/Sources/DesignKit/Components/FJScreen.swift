import SwiftUI

#if os(iOS)
/// Envelope padrão para o corpo de uma tela: aplica `.navigationTitle` + `fjTopBarStyle()` num
/// único lugar, para que toda tela nova (ou migrada) tenha o mesmo app bar do FilmJournal web só
/// por usar `FJScreen` em vez de chamar os modifiers na mão.
///
/// Outros modifiers específicos da tela (`.task`, `.toolbar`, `.searchable`, `.alert`,
/// `.refreshable`...) continuam sendo aplicados normalmente, por fora do `FJScreen`:
/// ```swift
/// var body: some View {
///     FJScreen("Diário") {
///         content
///     }
///     .task { await viewModel.load(api: api) }
/// }
/// ```
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
