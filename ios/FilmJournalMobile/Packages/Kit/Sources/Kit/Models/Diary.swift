import Foundation

/// Versão enxuta de `LogEntry`, com um resumo do filme em vez do `Movie` inteiro.
public struct DiaryEntry: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let watchedAt: Date?
    public let loggedAt: Date?
    public let rating: Double?
    public let review: String?
    public let rewatch: Bool
    public let tags: String?
    public let movie: DiaryEntryMovie

    public init(
        id: String,
        watchedAt: Date?,
        loggedAt: Date?,
        rating: Double?,
        review: String?,
        rewatch: Bool,
        tags: String?,
        movie: DiaryEntryMovie
    ) {
        self.id = id
        self.watchedAt = watchedAt
        self.loggedAt = loggedAt
        self.rating = rating
        self.review = review
        self.rewatch = rewatch
        self.tags = tags
        self.movie = movie
    }

    public var tagList: [String] {
        (tags ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }
}

public struct DiaryEntryMovie: Decodable, Sendable, Equatable {
    public let id: String
    public let title: String
    public let year: Int?
    public let genres: String?
    public let posterPath: String?
    public let preferredPosterPath: String?
    public let favorite: Bool

    public init(
        id: String,
        title: String,
        year: Int?,
        genres: String?,
        posterPath: String?,
        preferredPosterPath: String?,
        favorite: Bool
    ) {
        self.id = id
        self.title = title
        self.year = year
        self.genres = genres
        self.posterPath = posterPath
        self.preferredPosterPath = preferredPosterPath
        self.favorite = favorite
    }

    public var effectivePosterPath: String? { preferredPosterPath ?? posterPath }

    public var genreList: [String] {
        (genres ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }
}

public struct DiaryData: Decodable, Sendable {
    public let entries: [DiaryEntry]
    public let reviews: Int
    public let rewatches: Int
}
