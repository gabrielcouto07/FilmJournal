import SwiftUI
import DesignKit

/// `NavigationStack` ligado a um `Router<R>`. Existe porque `Router` é um `ObservableObject`
/// dentro de outro (`RootCoordinator`), e uma view que só observa o pai não reage a mudanças em
/// `path` — aqui o router entra como `@ObservedObject` e volta a publicar.
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
