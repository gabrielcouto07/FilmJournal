import Foundation

/// Autenticação contra o NextAuth.js (Credentials provider, sessão JWT em cookie httpOnly).
///
/// O FilmJournal web não expõe uma rota REST dedicada de login — o `signIn()` do NextAuth faz
/// esse trabalho no browser. Para o app nativo, reproduzimos a mesma dança que o client web do
/// NextAuth faz por baixo dos panos:
///   1. `GET /api/auth/csrf` — obtém um token CSRF e grava o cookie correspondente.
///   2. `POST /api/auth/callback/credentials` — autentica; em caso de sucesso o backend define o
///      cookie de sessão via `Set-Cookie` (a `URLSession` armazena e reenvia isso automaticamente).
///   3. `GET /api/auth/session` — confirma que a sessão pegou e devolve o usuário logado.
///
/// Isso é um contorno legítimo e funciona hoje, mas é sensível a mudanças internas do Auth.js.
/// Se o backend algum dia expuser um endpoint de login dedicado para clients nativos (ex.
/// devolvendo um JWT via `Authorization: Bearer`), esta é a única classe que precisa mudar.
public final class AuthService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    private struct CsrfResponse: Decodable { let csrfToken: String }

    public func login(username: String, password: String) async throws -> User {
        let csrf: CsrfResponse = try await client.request(.get, "/api/auth/csrf")

        _ = try await client.formRequest("/api/auth/callback/credentials", form: [
            "csrfToken": csrf.csrfToken,
            "username": username,
            "password": password,
            "callbackUrl": client.config.baseURL.absoluteString,
            "json": "true",
        ])

        guard let user = try await currentUser() else {
            throw APIError.server(status: 401, message: "Usuário ou senha inválidos.")
        }
        return user
    }

    public func currentUser() async throws -> User? {
        let response: SessionResponse = try await client.request(.get, "/api/auth/session")
        guard let sessionUser = response.user else { return nil }
        return User(
            id: sessionUser.id,
            username: sessionUser.username,
            email: sessionUser.email,
            displayName: sessionUser.displayName,
            role: sessionUser.role
        )
    }

    @discardableResult
    public func register(_ request: RegisterRequest) async throws -> RegisterResponse {
        try await client.request(.post, "/api/auth/register", body: request)
    }

    public func logout() async throws {
        let csrf: CsrfResponse = try await client.request(.get, "/api/auth/csrf")
        _ = try await client.formRequest("/api/auth/signout", form: [
            "csrfToken": csrf.csrfToken,
            "callbackUrl": client.config.baseURL.absoluteString,
            "json": "true",
        ])
    }
}
