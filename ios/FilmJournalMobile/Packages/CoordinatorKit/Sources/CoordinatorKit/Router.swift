import Foundation
import Combine

/// Router genérico por fluxo — encapsula a pilha de navegação de uma `NavigationStack`.
///
/// Cada feature (Diário, Coleção, Busca...) tem seu próprio `Router<SuaRoute>`, o que mantém as
/// pilhas independentes entre abas (trocar de aba não perde o histórico de navegação da outra).
/// `path` é compatível diretamente com `NavigationStack(path:)`, que aceita qualquer
/// `RangeReplaceableCollection` de elementos `Hashable` — não precisamos de `NavigationPath`.
@MainActor
public final class Router<R: Hashable>: ObservableObject {
    @Published public var path: [R] = []

    public init() {}

    public func push(_ route: R) {
        path.append(route)
    }

    public func pop() {
        guard !path.isEmpty else { return }
        path.removeLast()
    }

    public func popToRoot() {
        path.removeAll()
    }

    public func popTo(_ route: R) {
        guard let index = path.firstIndex(of: route) else { return }
        path.removeSubrange((index + 1)...)
    }

    public var isAtRoot: Bool { path.isEmpty }
}
