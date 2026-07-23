import Foundation

/// Ref. ao catálogo local para um resultado do TMDB (`existing` em `GET /api/tmdb`).
public struct TmdbExistingRef: Decodable, Sendable, Equatable {
    public let id: String
    public let tmdbId: Int?
    public let updatedAt: Date
    public let watchlist: Bool
    public let favorite: Bool?
    public let favoriteRank: Int?
}

/// Item de busca/feed do TMDB (`TmdbMovieSearchResult`), com `existing` mesclado pelo backend.
public struct TmdbMovieSearchResult: Decodable, Sendable, Equatable, Identifiable {
    public let id: Int
    public let title: String
    public let originalTitle: String?
    public let releaseDate: String?
    public let posterPath: String?
    public let backdropPath: String?
    public let overview: String?
    public let voteAverage: Double?
    public let voteCount: Int?
    public let popularity: Double?
    public let genreIds: [Int]?
    public let existing: TmdbExistingRef?

    public var year: Int? {
        guard let releaseDate, releaseDate.count >= 4 else { return nil }
        return Int(releaseDate.prefix(4))
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, overview, existing
        case originalTitle = "original_title"
        case releaseDate = "release_date"
        case posterPath = "poster_path"
        case backdropPath = "backdrop_path"
        case voteAverage = "vote_average"
        case voteCount = "vote_count"
        case popularity
        case genreIds = "genre_ids"
    }
}

public struct TmdbSearchResponse: Decodable, Sendable {
    public let page: Int
    public let totalPages: Int
    public let totalResults: Int
    public let results: [TmdbMovieSearchResult]

    private enum CodingKeys: String, CodingKey {
        case page, results
        case totalPages = "total_pages"
        case totalResults = "total_results"
    }
}

public enum TmdbFeed: String, Sendable, CaseIterable {
    case trending
    case popular
    case nowPlaying = "now-playing"
    case topRated = "top-rated"
    case upcoming
}

/// `TmdbGenre` (usado em `genres` dos detalhes e em `/api/roulette/genres`).
public struct TmdbGenre: Decodable, Sendable, Equatable, Identifiable {
    public let id: Int
    public let name: String
}

public struct TmdbPoster: Decodable, Sendable, Equatable {
    public let filePath: String
    public let width: Int
    public let height: Int
    public let aspectRatio: Double
    public let voteAverage: Double
    public let voteCount: Int
    public let iso6391: String?

    private enum CodingKeys: String, CodingKey {
        case filePath = "file_path"
        case width, height
        case aspectRatio = "aspect_ratio"
        case voteAverage = "vote_average"
        case voteCount = "vote_count"
        case iso6391 = "iso_639_1"
    }
}

/// Detalhes completos de um filme (`TmdbMovieDetails`), usado na ficha do filme e no jogo.
public struct TmdbMovieDetails: Decodable, Sendable {
    public struct ProductionCountry: Decodable, Sendable, Equatable {
        public let iso31661: String
        public let name: String
        private enum CodingKeys: String, CodingKey { case iso31661 = "iso_3166_1", name }
    }
    public struct ProductionCompany: Decodable, Sendable, Equatable, Identifiable {
        public let id: Int
        public let name: String
    }
    public struct Keyword: Decodable, Sendable, Equatable, Identifiable {
        public let id: Int
        public let name: String
    }
    public struct ExternalIds: Decodable, Sendable, Equatable {
        public let imdbId: String?
        private enum CodingKeys: String, CodingKey { case imdbId = "imdb_id" }
    }
    public struct Images: Decodable, Sendable, Equatable {
        public let posters: [TmdbPoster]
        public let backdrops: [TmdbPoster]
    }
    public struct CrewMember: Decodable, Sendable, Equatable, Identifiable {
        public let id: Int
        public let name: String
        public let job: String
        public let department: String
    }
    public struct CastMember: Decodable, Sendable, Equatable, Identifiable {
        public let id: Int
        public let name: String
        public let character: String?
        public let order: Int
        public let profilePath: String?
        private enum CodingKeys: String, CodingKey { case id, name, character, order, profilePath = "profile_path" }
    }
    public struct Credits: Decodable, Sendable, Equatable {
        public let crew: [CrewMember]
        public let cast: [CastMember]
    }
    public struct Keywords: Decodable, Sendable, Equatable {
        public let keywords: [Keyword]
    }

    public let id: Int
    public let title: String
    public let originalTitle: String?
    public let releaseDate: String?
    public let posterPath: String?
    public let backdropPath: String?
    public let overview: String?
    public let voteAverage: Double?
    public let voteCount: Int?
    public let popularity: Double?
    public let genreIds: [Int]?
    public let tagline: String?
    public let runtime: Int?
    public let originalLanguage: String?
    public let genres: [TmdbGenre]?
    public let productionCountries: [ProductionCountry]?
    public let productionCompanies: [ProductionCompany]?
    public let keywords: Keywords?
    public let externalIds: ExternalIds?
    public let images: Images?
    public let credits: Credits?

    public var director: CrewMember? { credits?.crew.first { $0.job == "Director" } }

    private enum CodingKeys: String, CodingKey {
        case id, title, overview, tagline, runtime, genres, credits, keywords, images
        case originalTitle = "original_title"
        case releaseDate = "release_date"
        case posterPath = "poster_path"
        case backdropPath = "backdrop_path"
        case voteAverage = "vote_average"
        case voteCount = "vote_count"
        case popularity
        case genreIds = "genre_ids"
        case originalLanguage = "original_language"
        case productionCountries = "production_countries"
        case productionCompanies = "production_companies"
        case externalIds = "external_ids"
    }
}

/// Resposta de `GET /api/tmdb?id=`.
public struct TmdbMovieDetailsResponse: Decodable, Sendable {
    public let movie: TmdbMovieDetails
    public let existing: TmdbExistingRef?
}

public struct TmdbPersonSearchResult: Decodable, Sendable, Equatable, Identifiable {
    public let id: Int
    public let name: String
    public let knownForDepartment: String?
    public let profilePath: String?

    private enum CodingKeys: String, CodingKey {
        case id, name
        case knownForDepartment = "known_for_department"
        case profilePath = "profile_path"
    }
}
