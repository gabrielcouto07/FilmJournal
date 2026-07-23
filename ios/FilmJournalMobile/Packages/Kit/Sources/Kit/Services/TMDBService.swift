import Foundation

/// `GET /api/tmdb` — proxy do backend para o TMDB, já mesclado com `existing` do catálogo
/// local. Preferimos este endpoint a chamar o TMDB direto: ele já respeita `showAdultContent`
/// das settings do usuário e evita distribuir a chave do TMDB no app.
public final class TMDBService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    public func search(query: String, year: Int? = nil, page: Int = 1) async throws -> TmdbSearchResponse {
        try await client.request(.get, "/api/tmdb", query: [
            "q": query,
            "year": year.map(String.init),
            "page": String(page),
        ])
    }

    public func feed(_ feed: TmdbFeed, page: Int = 1) async throws -> TmdbSearchResponse {
        try await client.request(.get, "/api/tmdb", query: [
            "feed": feed.rawValue,
            "page": String(page),
        ])
    }

    public func details(tmdbId: Int) async throws -> TmdbMovieDetailsResponse {
        try await client.request(.get, "/api/tmdb", query: ["id": String(tmdbId)])
    }
}
