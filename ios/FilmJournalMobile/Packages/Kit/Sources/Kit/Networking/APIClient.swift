import Foundation

/// Client HTTP central do app. Fala com o backend `api/` (Fastify) do FilmJournal.
///
/// Autenticação é **JWT stateless via `Authorization: Bearer`** (`api/src/plugins/jwt.ts`,
/// "igual para web e ios") — não há mais cookie de sessão do NextAuth. O `access token` é
/// anexado em toda requisição autenticada; em um 401 (exceto nas próprias rotas de `/auth/*`)
/// tentamos renovar uma única vez via `refresh token` antes de repassar o erro. Os tokens vivem
/// no Keychain via `TokenStore` (ver arquivo irmão), não em `HTTPCookieStorage`.
///
/// As rotas do backend não têm prefixo `/api` (ex. `/movies`, `/logs`, `/auth/login`) — isso
/// mudou na separação frontend/backend (commit `26c5c92`); todo `Service` deste pacote já
/// chama os paths sem esse prefixo.
public final class APIClient {
    public let config: AppConfig
    private let session: URLSession
    private let tokenStore: TokenStore
    private let refreshCoordinator = TokenRefreshCoordinator()

    public init(config: AppConfig, tokenStore: TokenStore = .shared) {
        self.config = config
        self.tokenStore = tokenStore
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = config.requestTimeout
        self.session = URLSession(configuration: configuration)
    }

    // MARK: - JSON requests

    /// GET (ou qualquer método sem corpo) decodificando a resposta.
    @discardableResult
    public func request<Response: Decodable>(
        _ method: HTTPMethod,
        _ path: String,
        query: [String: String?] = [:]
    ) async throws -> Response {
        let (data, _) = try await authorizedRequest(method, path, query: query, body: nil, contentType: nil)
        return try decode(data)
    }

    /// Requisição com corpo JSON codificado a partir de um `Encodable`.
    @discardableResult
    public func request<Body: Encodable, Response: Decodable>(
        _ method: HTTPMethod,
        _ path: String,
        query: [String: String?] = [:],
        body: Body
    ) async throws -> Response {
        let payload = try encode(body)
        let (data, _) = try await authorizedRequest(method, path, query: query, body: payload, contentType: "application/json")
        return try decode(data)
    }

    /// Igual ao anterior, mas descarta o corpo da resposta — útil quando só o status importa.
    public func requestDiscardingResponse<Body: Encodable>(
        _ method: HTTPMethod,
        _ path: String,
        query: [String: String?] = [:],
        body: Body
    ) async throws {
        let payload = try encode(body)
        _ = try await authorizedRequest(method, path, query: query, body: payload, contentType: "application/json")
    }

    public func requestDiscardingResponse(
        _ method: HTTPMethod,
        _ path: String,
        query: [String: String?] = [:]
    ) async throws {
        _ = try await authorizedRequest(method, path, query: query, body: nil, contentType: nil)
    }

    private func encode<Body: Encodable>(_ body: Body) throws -> Data {
        do {
            return try JSONCoding.encoder.encode(body)
        } catch {
            throw APIError.encoding(error.localizedDescription)
        }
    }

    private func decode<Response: Decodable>(_ data: Data) throws -> Response {
        if Response.self == EmptyResponse.self {
            return EmptyResponse() as! Response
        }
        do {
            return try JSONCoding.decoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(error.localizedDescription)
        }
    }

    // MARK: - Multipart (import do Letterboxd, upload de avatar)

    public func upload<Response: Decodable>(
        _ path: String,
        fileFieldName: String,
        fileName: String,
        fileData: Data,
        mimeType: String = "application/zip"
    ) async throws -> Response {
        try await upload(path, parts: [(fieldName: fileFieldName, fileName: fileName, mimeType: mimeType, data: fileData)])
    }

    /// Variante com múltiplos arquivos (ex. CSVs soltos do Letterboxd, um campo por arquivo).
    public func upload<Response: Decodable>(
        _ path: String,
        parts: [(fieldName: String, fileName: String, mimeType: String, data: Data)]
    ) async throws -> Response {
        let boundary = "FilmJournalBoundary-\(UUID().uuidString)"
        var body = Data()
        for part in parts {
            body.append("--\(boundary)\r\n".utf8Data)
            body.append("Content-Disposition: form-data; name=\"\(part.fieldName)\"; filename=\"\(part.fileName)\"\r\n".utf8Data)
            body.append("Content-Type: \(part.mimeType)\r\n\r\n".utf8Data)
            body.append(part.data)
            body.append("\r\n".utf8Data)
        }
        body.append("--\(boundary)--\r\n".utf8Data)

        let (data, _) = try await authorizedRequest(.post, path, query: [:], body: body, contentType: "multipart/form-data; boundary=\(boundary)")
        return try decode(data)
    }

    // MARK: - Auth (renovação transparente de token)

    /// Igual a `rawRequest`, mas anexa `Authorization: Bearer` e, se a resposta vier 401 (e a
    /// rota não for `/auth/*`), tenta renovar o access token uma única vez e repete a chamada.
    @discardableResult
    private func authorizedRequest(
        _ method: HTTPMethod,
        _ path: String,
        query: [String: String?],
        body: Data?,
        contentType: String?
    ) async throws -> (Data, HTTPURLResponse) {
        do {
            return try await rawRequest(method, path, query: query, body: body, contentType: contentType, authToken: tokenStore.accessToken)
        } catch APIError.server(status: 401, message: _) where !path.hasPrefix("/auth/") {
            let newToken = try await refreshedAccessToken()
            return try await rawRequest(method, path, query: query, body: body, contentType: contentType, authToken: newToken)
        }
    }

    /// Garante que só existe uma renovação de token em voo por vez (chamadas concorrentes da
    /// Home, por exemplo, não devem disparar várias `/auth/refresh` em paralelo).
    private func refreshedAccessToken() async throws -> String {
        try await refreshCoordinator.refreshedToken { [weak self] in
            guard let self else { throw APIError.notAuthenticated }
            return try await self.performRefresh()
        }
    }

    private func performRefresh() async throws -> String {
        guard let refreshToken = tokenStore.refreshToken else {
            throw APIError.notAuthenticated
        }
        struct RefreshBody: Encodable { let refreshToken: String }
        struct RefreshResponse: Decodable { let accessToken: String }
        do {
            let payload = try encode(RefreshBody(refreshToken: refreshToken))
            let (data, _) = try await rawRequest(.post, "/auth/refresh", query: [:], body: payload, contentType: "application/json", authToken: nil)
            let response: RefreshResponse = try decode(data)
            tokenStore.accessToken = response.accessToken
            return response.accessToken
        } catch {
            tokenStore.clear()
            NotificationCenter.default.post(name: .filmJournalSessionExpired, object: nil)
            throw APIError.notAuthenticated
        }
    }

    // MARK: - Core

    @discardableResult
    private func rawRequest(
        _ method: HTTPMethod,
        _ path: String,
        query: [String: String?],
        body: Data?,
        contentType: String?,
        authToken: String?
    ) async throws -> (Data, HTTPURLResponse) {
        guard var components = URLComponents(url: config.baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL
        }
        if !query.isEmpty {
            components.queryItems = query.compactMap { key, value in
                value.map { URLQueryItem(name: key, value: $0) }
            }
        }
        guard let url = components.url else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let contentType {
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }
        if let authToken {
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
            guard (200...299).contains(http.statusCode) else {
                if let payload = try? JSONCoding.decoder.decode(APIErrorPayload.self, from: data) {
                    throw APIError.server(status: http.statusCode, message: payload.error)
                }
                throw APIError.server(status: http.statusCode, message: "Erro inesperado (\(http.statusCode)).")
            }
            return (data, http)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
    }
}

/// Single-flight para `/auth/refresh`: se várias chamadas simultâneas topam com um 401,
/// só a primeira dispara a renovação de verdade — as demais esperam o mesmo `Task`.
private actor TokenRefreshCoordinator {
    private var inFlight: Task<String, Error>?

    func refreshedToken(_ operation: @escaping () async throws -> String) async throws -> String {
        if let inFlight { return try await inFlight.value }
        let task = Task { try await operation() }
        inFlight = task
        defer { inFlight = nil }
        return try await task.value
    }
}

/// Resposta "vazia" para endpoints cujo corpo não interessa ao chamador.
public struct EmptyResponse: Decodable {}

extension Notification.Name {
    /// Postada quando a renovação do access token falha definitivamente (refresh token ausente,
    /// expirado ou o backend recusou) — o app deve tratar isso como logout forçado.
    public static let filmJournalSessionExpired = Notification.Name("FilmJournalSessionExpired")
}

private extension String {
    var utf8Data: Data { Data(utf8) }
}
