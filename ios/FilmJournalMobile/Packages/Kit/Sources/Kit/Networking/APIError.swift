import Foundation

/// Espelha o formato `{ error: "mensagem" }` devolvido por todas as rotas do FilmJournal.
public struct APIErrorPayload: Decodable {
    public let error: String
}

public enum APIError: Error, LocalizedError, Equatable {
    case notAuthenticated
    case invalidURL
    case invalidResponse
    case decoding(String)
    case encoding(String)
    case server(status: Int, message: String)
    case transport(String)

    public var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Faça login para continuar."
        case .invalidURL:
            return "URL inválida."
        case .invalidResponse:
            return "Resposta inválida do servidor."
        case .decoding(let message):
            return "Falha ao interpretar a resposta: \(message)"
        case .encoding(let message):
            return "Falha ao montar a requisição: \(message)"
        case .server(_, let message):
            return message
        case .transport(let message):
            return message
        }
    }

    /// Status HTTP quando a falha vier do servidor; útil para tratar 401/403/404/409 no chamador.
    public var statusCode: Int? {
        if case .server(let status, _) = self { return status }
        return nil
    }
}
