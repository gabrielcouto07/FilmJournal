import Foundation

/// `GET /api/recommendations` — a home "Paladar" (análise de gosto e recomendações).
public final class RecommendationsService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    /// `refresh: true` força recálculo (ignora o cache de 6h por fingerprint do acervo).
    public func taste(refresh: Bool = false) async throws -> TasteData {
        try await client.request(.get, "/api/recommendations", query: ["refresh": refresh ? "1" : nil])
    }
}
