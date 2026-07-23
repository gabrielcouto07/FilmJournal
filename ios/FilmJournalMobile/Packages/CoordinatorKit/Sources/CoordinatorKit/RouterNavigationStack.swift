import SwiftUI
import DesignKit

/// `NavigationStack` já ligado a um `Router<R>`.
///
/// Por que isso existe: `Router` é um `ObservableObject` guardado dentro de outro
/// `ObservableObject` (`RootCoordinator`). Ler `root.algumRouter.path` a partir de uma view que
/// só observa `root` via `@EnvironmentObject` NÃO reage a mudanças em `path` — só o próprio
/// `Router` publica essa mudança, não o `RootCoordinator` que o contém. Este wrapper resolve
/// isso guardando o `Router` recebido como `@ObservedObject`, queassim passa a reagir direto.
///
/// Uso em cada `*FlowView`:
/// ```swift
/// struct DiaryFlowView: View {
///     @EnvironmentObject private var root: RootCoordinator
///     var body: some View {
///         RouterNavigationStack(router: root.diaryRouter) {
///             DiaryView()
///         } destination: { route in
///             switch route {
///             case .filmDetail(let target): FilmDetailView(target: target)
///             case .logEditor(let movieId, let logId): LogEditorView(movieId: movieId, logId: logId)
///             }
///         }
///     }
/// }
/// ```
public struct RouterNavigationStack<R: Hashable, Root: View, Destination: View>: View {
    @ObservedObject private var router: Router<R>
    private let root: () -> Root
    private let destination: (R) -> Destination

    public init(
        router: Router<R>,
        @ViewBuilder root: @escaping () -> Root,
        @ViewBuilder destination: @escaping (R) -> Destination
    ) {
        self.router = router
        self.root = root
        self.destination = destination
    }

    public var body: some View {
        NavigationStack(path: $router.path) {
            root()
                .navigationDestination(for: R.self, destination: destination)
        }
        .fjTopBarStyle()
    }
}
