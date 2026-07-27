import Foundation

/// `/auth/*` — login/registro devolvem o par de tokens, que fica no `TokenStore`.
public final class AuthService {
    private let client: APIClient
    private let tokenStore: TokenStore

    public init(client: APIClient, tokenStore: TokenStore = .shared) {
        self.client = client
        self.tokenStore = tokenStore
    }

    private struct LoginRequest: Encodable { let username: String; let password: String }
    private struct AuthResponse: Decodable { let accessToken: String; let refreshToken: String; let user: User }
    private struct MeResponse: Decodable { let user: User }

    @discardableResult
    public func login(username: String, password: String) async throws -> User {
        let response: AuthResponse = try await client.request(.post, "/auth/login", body: LoginRequest(username: username, password: password))
        tokenStore.store(accessToken: response.accessToken, refreshToken: response.refreshToken)
        return response.user
    }

    /// `nil` quando não há sessão aproveitável; o `APIClient` já tentou renovar antes disso.
    public func currentUser() async throws -> User? {
        guard tokenStore.accessToken != nil || tokenStore.refreshToken != nil else { return nil }
        do {
            let response: MeResponse = try await client.request(.get, "/auth/me")
            return response.user
        } catch {
            return nil
        }
    }

    /// Já deixa a conta nova autenticada, sem precisar de um login em seguida.
    @discardableResult
    public func register(_ request: RegisterRequest) async throws -> User {
        let response: AuthResponse = try await client.request(.post, "/auth/register", body: request)
        tokenStore.store(accessToken: response.accessToken, refreshToken: response.refreshToken)
        return response.user
    }

    /// Só descarta os tokens locais: não há sessão no servidor para invalidar.
    public func logout() async throws {
        tokenStore.clear()
    }
}
