import Foundation

/// Resposta de `POST /api/import/letterboxd` — a forma exata de `summary`/`errors` é best-effort
/// (o backend não expõe um tipo fixo); mantemos como JSON flexível para não travar em mudanças.
public struct LetterboxdImportResponse: Decodable, Sendable {
    public let ok: Bool
    public let summary: JSONValue?
    public let errors: JSONValue?
}

/// Valor JSON dinâmico — usado só onde a API não tem uma forma tipada fixa e documentada.
public enum JSONValue: Decodable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null; return }
        if let value = try? container.decode(Bool.self) { self = .bool(value); return }
        if let value = try? container.decode(Double.self) { self = .number(value); return }
        if let value = try? container.decode(String.self) { self = .string(value); return }
        if let value = try? container.decode([String: JSONValue].self) { self = .object(value); return }
        if let value = try? container.decode([JSONValue].self) { self = .array(value); return }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Valor JSON não reconhecido.")
    }
}
