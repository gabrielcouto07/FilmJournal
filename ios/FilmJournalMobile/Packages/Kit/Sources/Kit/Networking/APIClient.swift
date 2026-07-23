import Foundation

/// Client HTTP central do app. Fala com a mesma API REST do FilmJournal (Next.js).
///
/// Autenticação usa o cookie de sessão do NextAuth (estratégia JWT em cookie httpOnly) — por
/// isso a `URLSession` usa `HTTPCookieStorage.shared`, que o iOS já persiste em disco entre
/// aberturas do app. Não é necessário (nem possível) ler o cookie manualmente: o sistema
/// aplica e reenvia os cookies automaticamente em toda requisição para o mesmo host.
///
/// Sobre CSRF: o backend só bloqueia mutações quando o header `Origin` está presente e não
/// bate com o `Host` (ver `isSameOrigin` em `src/lib/security.ts`). Um client nativo via
/// `URLSession` não envia `Origin` — a checagem já passa sem nenhum header extra.
public final class APIClient {
    public let config: AppConfig
    private let session: URLSession

    public init(config: AppConfig) {
        self.config = config
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = .shared
        configuration.httpShouldSetCookies = true
        configuration.httpCookieAcceptPolicy = .always
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
        let (data, _) = try await rawRequest(method, path, query: query, body: nil, contentType: nil)
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
        let payload: Data
        do {
            payload = try JSONCoding.encoder.encode(body)
        } catch {
            throw APIError.encoding(error.localizedDescription)
        }
        let (data, _) = try await rawRequest(method, path, query: query, body: payload, contentType: "application/json")
        return try decode(data)
    }

    /// Igual ao anterior, mas descarta o corpo da resposta — útil quando só o status importa.
    public func requestDiscardingResponse<Body: Encodable>(
        _ method: HTTPMethod,
        _ path: String,
        query: [String: String?] = [:],
        body: Body
    ) async throws {
        let payload: Data
        do {
            payload = try JSONCoding.encoder.encode(body)
        } catch {
            throw APIError.encoding(error.localizedDescription)
        }
        _ = try await rawRequest(method, path, query: query, body: payload, contentType: "application/json")
    }

    public func requestDiscardingResponse(
        _ method: HTTPMethod,
        _ path: String,
        query: [String: String?] = [:]
    ) async throws {
        _ = try await rawRequest(method, path, query: query, body: nil, contentType: nil)
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

    // MARK: - Form-encoded (fluxo de login do NextAuth)

    @discardableResult
    func formRequest(_ path: String, form: [String: String]) async throws -> (Data, HTTPURLResponse) {
        let encoded = form.map { key, value in
            "\(percentEncode(key))=\(percentEncode(value))"
        }.joined(separator: "&")
        return try await rawRequest(.post, path, query: [:], body: Data(encoded.utf8), contentType: "application/x-www-form-urlencoded", followRedirects: false)
    }

    private func percentEncode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryValueAllowed) ?? value
    }

    // MARK: - Multipart (import do Letterboxd)

    public func upload<Response: Decodable>(
        _ path: String,
        fileFieldName: String,
        fileName: String,
        fileData: Data,
        mimeType: String = "application/zip"
    ) async throws -> Response {
        let boundary = "FilmJournalBoundary-\(UUID().uuidString)"
        var body = Data()
        body.append("--\(boundary)\r\n".utf8Data)
        body.append("Content-Disposition: form-data; name=\"\(fileFieldName)\"; filename=\"\(fileName)\"\r\n".utf8Data)
        body.append("Content-Type: \(mimeType)\r\n\r\n".utf8Data)
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n".utf8Data)

        let (data, _) = try await rawRequest(.post, path, query: [:], body: body, contentType: "multipart/form-data; boundary=\(boundary)")
        return try decode(data)
    }

    // MARK: - Core

    @discardableResult
    private func rawRequest(
        _ method: HTTPMethod,
        _ path: String,
        query: [String: String?],
        body: Data?,
        contentType: String?,
        followRedirects: Bool = true
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
        request.httpBody = body

        let delegate = followRedirects ? nil : NoRedirectDelegate()
        do {
            let (data, response): (Data, URLResponse)
            if let delegate {
                let session = URLSession(configuration: session.configuration, delegate: delegate, delegateQueue: nil)
                (data, response) = try await session.data(for: request)
            } else {
                (data, response) = try await session.data(for: request)
            }
            guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
            guard (200...299).contains(http.statusCode) || (!followRedirects && (300...399).contains(http.statusCode)) else {
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

/// Resposta "vazia" para endpoints cujo corpo não interessa ao chamador.
public struct EmptyResponse: Decodable {}

private final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        // O passo de login do NextAuth responde com um redirect (302); não seguimos porque só
        // nos interessa o Set-Cookie da própria resposta.
        completionHandler(nil)
    }
}

private extension CharacterSet {
    static let urlQueryValueAllowed: CharacterSet = {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return allowed
    }()
}

private extension String {
    var utf8Data: Data { Data(utf8) }
}
