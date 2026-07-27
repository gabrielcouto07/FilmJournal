import Foundation

/// Referência ao catálogo local de um resultado do TMDB, quando o filme já existe por aqui.
public struct TmdbExistingRef: Decodable, Sendable, Equatable {
    public let id: String
    public let tmdbId: Int?
    public let updatedAt: Date
    public let watchlist: Bool
    public let favorite: Bool?
    public let favoriteRank: Int?

    public init(id: String, tmdbId: Int?, updatedAt: Date, watchlist: Bool, favorite: Bool?, favoriteRank: Int?) {
        self.id = id
        self.tmdbId = tmdbId
        self.updatedAt = updatedAt
        self.watchlist = watchlist
        self.favorite = favorite
        self.favoriteRank = favoriteRank
    }
}

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

    /// Reflete uma ação rápida (watchlist/favorito) sem refazer a busca.
    public func withExisting(_ existing: TmdbExistingRef?) -> TmdbMovieSearchResult {
        TmdbMovieSearchResult(
            id: id,
            title: title,
            originalTitle: originalTitle,
            releaseDate: releaseDate,
            posterPath: posterPath,
            backdropPath: backdropPath,
            overview: overview,
            voteAverage: voteAverage,
            voteCount: voteCount,
            popularity: popularity,
            genreIds: genreIds,
            existing: existing
        )
    }

    public init(
        id: Int,
        title: String,
        originalTitle: String?,
        releaseDate: String?,
        posterPath: String?,
        backdropPath: String?,
        overview: String?,
        voteAverage: Double?,
        voteCount: Int?,
        popularity: Double?,
        genreIds: [Int]?,
        existing: TmdbExistingRef?
    ) {
        self.id = id
        self.title = title
        self.originalTitle = originalTitle
        self.releaseDate = releaseDate
        self.posterPath = posterPath
        self.backdropPath = backdropPath
        self.overview = overview
        self.voteAverage = voteAverage
        self.voteCount = voteCount
        self.popularity = popularity
        self.genreIds = genreIds
        self.existing = existing
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

public enum TmdbFeed: String, Sendable, CaseIterable, Identifiable {
    case trending
    case popular
    case nowPlaying = "now-playing"
    case topRated = "top-rated"
    case upcoming

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .trending: return "Em alta"
        case .popular: return "Popular"
        case .nowPlaying: return "Nos cinemas"
        case .topRated: return "Mais bem avaliados"
        case .upcoming: return "Em breve"
        }
    }
}

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
