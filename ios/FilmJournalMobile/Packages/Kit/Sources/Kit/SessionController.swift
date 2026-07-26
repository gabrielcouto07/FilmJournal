import Foundation
import Combine

/// Estado de sessão observável — a raiz de navegação do app decide login vs. app principal
/// observando `currentUser`. Não depende de SwiftUI, só de Combine (disponível em todo Apple OS).
@MainActor
public final class SessionController: ObservableObject {
    @Published public private(set) var currentUser: User?
    @Published public private(set) var isRestoringSession = true

    private let auth: AuthService
    private var expiryObserver: NSObjectProtocol?

    public init(auth: AuthService) {
        self.auth = auth
        expiryObserver = NotificationCenter.default.addObserver(
            forName: .filmJournalSessionExpired,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.currentUser = nil
            }
        }
    }

    deinit {
        if let expiryObserver {
            NotificationCenter.default.removeObserver(expiryObserver)
        }
    }

    public var isAuthenticated: Bool { currentUser != nil }

    /// Chamado na abertura do app: os tokens JWT vivem no Keychain (`TokenStore`), então uma
    /// sessão válida sobrevive a um relançamento do app sem precisar logar de novo — o
    /// `APIClient` renova o access token via refresh token automaticamente se preciso.
    public func restoreSession() async {
        isRestoringSession = true
        currentUser = try? await auth.currentUser()
        isRestoringSession = false
    }

    public func login(username: String, password: String) async throws {
        currentUser = try await auth.login(username: username, password: password)
    }

    @discardableResult
    public func register(_ request: RegisterRequest) async throws -> User {
        try await auth.register(request)
    }

    public func logout() async {
        try? await auth.logout()
        currentUser = nil
    }
}
