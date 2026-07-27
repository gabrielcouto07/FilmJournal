import Foundation

/// Coleção nomeada e livre do usuário, distinta de Favoritos/Top10/Watchlist.
public struct MovieList: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let description: String?
    public let isPublic: Bool
    public let createdAt: Date
    public let updatedAt: Date
    public let movieCount: Int
    /// Só vem preenchido em `GET /lists` (as 4 capas mais recentes) — vazio em outras respostas.
    public let previewMovies: [MovieListPreviewItem]
    /// Só é significativo quando a consulta passou `movieId`.
    public let containsMovie: Bool?

    private enum CodingKeys: String, CodingKey {
        case id, name, description, isPublic, createdAt, updatedAt
        case count = "_count"
        case movies
        case containsMovie
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        isPublic = try container.decode(Bool.self, forKey: .isPublic)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        movieCount = try container.decodeIfPresent(MovieListCount.self, forKey: .count)?.movies ?? 0
        previewMovies = try container.decodeIfPresent([MovieListPreviewItem].self, forKey: .movies) ?? []
        containsMovie = try container.decodeIfPresent(Bool.self, forKey: .containsMovie)
    }
}

private struct MovieListCount: Decodable { let movies: Int }

public struct MovieListPreviewItem: Decodable, Sendable, Identifiable, Equatable {
    public let movieId: String
    public let position: Int?
    public let addedAt: Date
    public let movie: MovieListMoviePreview

    public var id: String { movieId }
}

public struct MovieListMoviePreview: Decodable, Sendable, Equatable {
    public let id: String
    public let title: String
    public let posterPath: String?
    public let preferredPosterPath: String?

    public var effectivePosterPath: String? { preferredPosterPath ?? posterPath }
}

/// Como `MovieListPreviewItem`, mas com o `Movie` inteiro em vez do resumo.
public struct MovieListDetailItem: Decodable, Sendable, Identifiable, Equatable {
    public let movieId: String
    public let position: Int?
    public let addedAt: Date
    public let movie: Movie

    public var id: String { movieId }
}

public struct MovieListDetail: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let description: String?
    public let isPublic: Bool
    public let createdAt: Date
    public let updatedAt: Date
    public let movies: [MovieListDetailItem]

    public init(
        id: String,
        name: String,
        description: String?,
        isPublic: Bool,
        createdAt: Date,
        updatedAt: Date,
        movies: [MovieListDetailItem]
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.isPublic = isPublic
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.movies = movies
    }
}

// MARK: - Requests/Responses

public struct ListsResponse: Decodable, Sendable {
    public let lists: [MovieList]
}

struct ListDetailResponse: Decodable { let list: MovieListDetail }
struct ListMutationResponse: Decodable { let list: MovieList }

public struct CreateListRequest: Encodable, Sendable {
    public var name: String
    public var description: String?
    public var isPublic: Bool?

    public init(name: String, description: String? = nil, isPublic: Bool? = nil) {
        self.name = name
        self.description = description
        self.isPublic = isPublic
    }
}

public struct UpdateListRequest: Encodable, Sendable {
    public var name: String?
    public var description: String??
    public var isPublic: Bool?

    public init(name: String? = nil, description: String?? = nil, isPublic: Bool? = nil) {
        self.name = name
        self.description = description
        self.isPublic = isPublic
    }

    private enum CodingKeys: String, CodingKey { case name, description, isPublic }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(name, forKey: .name)
        if let description { try container.encode(description, forKey: .description) }
        try container.encodeIfPresent(isPublic, forKey: .isPublic)
    }
}

struct AddMovieToListRequest: Encodable { let movieId: String }

struct ListMovieMutationResponse: Decodable {
    let alreadyAdded: Bool
    let message: String?
}
