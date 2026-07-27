import Foundation

/// Via o proxy do backend, nunca o TMDB direto: a chave do TMDB não vai no app.
public final class TMDBService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    public func search(query: String, year: Int? = nil, page: Int = 1) async throws -> TmdbSearchResponse {
        try await client.request(.get, "/tmdb", query: [
            "q": query,
            "year": year.map(String.init),
            "page": String(page),
        ])
    }

    public func feed(_ feed: TmdbFeed, page: Int = 1) async throws -> TmdbSearchResponse {
        try await client.request(.get, "/tmdb", query: [
            "feed": feed.rawValue,
            "page": String(page),
        ])
    }

    public func details(tmdbId: Int) async throws -> TmdbMovieDetailsResponse {
        try await client.request(.get, "/tmdb", query: ["id": String(tmdbId)])
    }
}
