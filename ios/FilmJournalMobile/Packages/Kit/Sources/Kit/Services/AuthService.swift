import Foundation

/// Autenticação contra o backend `api/` — JWT stateless via `Authorization: Bearer`
/// (`api/src/plugins/jwt.ts`, "igual para web e ios"). Sem cookie, sem CSRF, sem NextAuth: um
/// `POST /auth/login` já devolve `{accessToken, refreshToken, user}` diretamente.
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

    /// `GET /auth/me` — devolve o usuário do access token guardado, ou lança se não houver
    /// sessão válida (o `APIClient` já tenta renovar via refresh token antes de desistir).
    public func currentUser() async throws -> User? {
        guard tokenStore.accessToken != nil || tokenStore.refreshToken != nil else { return nil }
        do {
            let response: MeResponse = try await client.request(.get, "/auth/me")
            return response.user
        } catch {
            return nil
        }
    }

    /// `POST /auth/register` já autentica a conta nova (mesma resposta do login).
    @discardableResult
    public func register(_ request: RegisterRequest) async throws -> User {
        let response: AuthResponse = try await client.request(.post, "/auth/register", body: request)
        tokenStore.store(accessToken: response.accessToken, refreshToken: response.refreshToken)
        return response.user
    }

    /// Sem endpoint de logout no backend (JWT stateless não tem sessão para invalidar) — só
    /// descarta os tokens locais.
    public func logout() async throws {
        tokenStore.clear()
    }
}
