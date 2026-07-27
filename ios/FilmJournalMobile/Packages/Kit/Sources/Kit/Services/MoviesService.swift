import Foundation

/// `/movies*` — catálogo local (já mesclado com o estado do usuário) e mutações de coleção.
public final class MoviesService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    public func list(query: String = "", watchlistOnly: Bool = false, limit: Int = 40) async throws -> [Movie] {
        let response: MoviesListResponse = try await client.request(.get, "/movies", query: [
            "q": query.isEmpty ? nil : query,
            "watchlist": watchlistOnly ? "true" : nil,
            "limit": String(limit),
        ])
        return response.movies
    }

    public func detail(id: String) async throws -> MovieDetailResponse {
        try await client.request(.get, "/movies/\(id)")
    }

    public func add(tmdbId: Int, watchlist: Bool? = nil) async throws -> MovieUpsertResponse {
        try await client.request(.post, "/movies", body: AddMovieRequest(tmdbId: tmdbId, watchlist: watchlist))
    }

    public func mutate(movieId: String, action: MovieCollectionAction) async throws -> MovieMutationResponse {
        try await client.request(.patch, "/movies", body: MovieMutationRequest.from(movieId: movieId, action: action))
    }

    /// Aceita um `movieId` já salvo ou um `title` livre.
    public func resolveArtwork(movieId: String? = nil, title: String? = nil) async throws -> String? {
        struct Request: Encodable { var movieId: String?; var title: String? }
        struct Response: Decodable { let posterUrl: String? }
        let response: Response = try await client.request(.post, "/movies/artwork", body: Request(movieId: movieId, title: title))
        return response.posterUrl
    }

    /// Preenche metadados faltantes em lote.
    public func enrich(movieIds: [String]? = nil, limit: Int? = nil) async throws -> (enriched: Int, requested: Int) {
        struct Request: Encodable { var movieIds: [String]?; var limit: Int? }
        struct Response: Decodable { let enriched: Int; let requested: Int }
        let response: Response = try await client.request(.post, "/movies/enrich", body: Request(movieIds: movieIds, limit: limit))
        return (response.enriched, response.requested)
    }
}
