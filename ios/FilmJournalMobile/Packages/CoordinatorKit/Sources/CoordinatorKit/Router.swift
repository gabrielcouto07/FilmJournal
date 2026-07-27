import Foundation
import Combine

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
