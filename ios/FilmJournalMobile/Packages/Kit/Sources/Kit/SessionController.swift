import Foundation
import Combine

/// A raiz de navegação decide login vs. app principal olhando `currentUser`.
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

    /// Chamar na abertura: os tokens ficam no Keychain, então a sessão sobrevive ao relançamento.
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
