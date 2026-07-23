import Foundation
import Combine

/// Estado de sessão observável — a raiz de navegação do app decide login vs. app principal
/// observando `currentUser`. Não depende de SwiftUI, só de Combine (disponível em todo Apple OS).
@MainActor
public final class SessionController: ObservableObject {
    @Published public private(set) var currentUser: User?
    @Published public private(set) var isRestoringSession = true

    private let auth: AuthService

    public init(auth: AuthService) {
        self.auth = auth
    }

    public var isAuthenticated: Bool { currentUser != nil }

    /// Chamado na abertura do app: o cookie de sessão persiste em disco (`HTTPCookieStorage`),
    /// então uma sessão válida sobrevive a um relançamento do app sem precisar logar de novo.
    public func restoreSession() async {
        isRestoringSession = true
        currentUser = try? await auth.currentUser()
        isRestoringSession = false
    }

    public func login(username: String, password: String) async throws {
        currentUser = try await auth.login(username: username, password: password)
    }

    @discardableResult
    public func register(_ request: RegisterRequest) async throws -> RegisterResponse {
        try await auth.register(request)
    }

    public func logout() async {
        try? await auth.logout()
        currentUser = nil
    }
}
