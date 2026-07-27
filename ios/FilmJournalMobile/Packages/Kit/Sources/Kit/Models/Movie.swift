import Foundation

/// Filme do catálogo compartilhado, já mesclado com o estado pessoal do usuário atual.
public struct Movie: Decodable, Sendable, Identifiable, Equatable, Hashable {
    public let id: String
    public let tmdbId: Int?
    public let title: String
    public let year: Int?
    public let releaseDate: Date?
    public let letterboxdUri: String?
    public let posterPath: String?
    public let backdropPath: String?
    public let preferredPosterPath: String?
    public let preferredBackdropPath: String?
    public let overview: String?
    public let tagline: String?
    public let runtime: Int?
    public let genres: String?
    public let directors: String?
    public let directorId: Int?
    public let directorName: String?
    public let cast: String?
    public let tmdbRating: Double?
    public let tmdbVoteCount: Int?
    public let originalLanguage: String?
    public let countries: [String]
    public let imdbId: String?
    public let createdAt: Date
    public let updatedAt: Date

    public let rating: Double?
    public let watched: Bool
    public let favorite: Bool
    public let watchlist: Bool
    public let watchlistAddedAt: Date?
    public let favoriteRank: Int?

    public var effectivePosterPath: String? { preferredPosterPath ?? posterPath }
    public var effectiveBackdropPath: String? { preferredBackdropPath ?? backdropPath }

    public static func == (lhs: Movie, rhs: Movie) -> Bool { lhs.id == rhs.id }
    public func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

public struct MoviesListResponse: Decodable, Sendable {
    public let movies: [Movie]
}

/// Traz o histórico completo de sessões, sem o limite de 200 registros de `GET /logs`.
public struct MovieDetailResponse: Decodable, Sendable {
    public let movie: Movie
    public let logs: [LogEntry]
}

public struct MovieUpsertResponse: Decodable, Sendable {
    public let movie: Movie
    public let created: Bool
    public let message: String?
}

public struct MovieMutationResponse: Decodable, Sendable {
    public let movie: Movie
    public let message: String?
}

public struct AddMovieRequest: Encodable, Sendable {
    public let tmdbId: Int
    public var watchlist: Bool?

    public init(tmdbId: Int, watchlist: Bool? = nil) {
        self.tmdbId = tmdbId
        self.watchlist = watchlist
    }
}

public enum MovieCollectionAction: Sendable {
    case watchlist(Bool)
    case favorite(Bool)
    case top10(Bool)
    case favoriteRank(Int?)
    case rating(Double?)
    /// Somente para o usuário `OWNER`; `path` é um caminho de imagem do TMDB (`/xxxx.jpg`).
    case poster(String)
    case backdrop(String)
}

struct MovieMutationRequest: Encodable {
    let movieId: String
    let action: String
    var value: AnyEncodable?
    var rank: Int??

    private enum CodingKeys: String, CodingKey { case movieId, action, value, rank }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(movieId, forKey: .movieId)
        try container.encode(action, forKey: .action)
        try container.encodeIfPresent(value, forKey: .value)
        if let rank { try container.encode(rank, forKey: .rank) }
    }

    static func from(movieId: String, action: MovieCollectionAction) -> MovieMutationRequest {
        switch action {
        case .watchlist(let value):
            return MovieMutationRequest(movieId: movieId, action: "watchlist", value: AnyEncodable(value))
        case .favorite(let value):
            return MovieMutationRequest(movieId: movieId, action: "favorite", value: AnyEncodable(value))
        case .top10(let value):
            return MovieMutationRequest(movieId: movieId, action: "top10", value: AnyEncodable(value))
        case .favoriteRank(let rank):
            return MovieMutationRequest(movieId: movieId, action: "favoriteRank", value: nil, rank: rank)
        case .rating(let rating):
            return MovieMutationRequest(movieId: movieId, action: "rating", value: rating.map(AnyEncodable.init) ?? AnyEncodable(Optional<Double>.none))
        case .poster(let path):
            return MovieMutationRequest(movieId: movieId, action: "poster", value: AnyEncodable(path))
        case .backdrop(let path):
            return MovieMutationRequest(movieId: movieId, action: "backdrop", value: AnyEncodable(path))
        }
    }
}

/// Apaga o tipo de um `Encodable` para encaixar valores heterogêneos num mesmo campo JSON.
public struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    public init<T: Encodable>(_ value: T) {
        encodeClosure = { encoder in
            var container = encoder.singleValueContainer()
            try container.encode(value)
        }
    }

    public func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
