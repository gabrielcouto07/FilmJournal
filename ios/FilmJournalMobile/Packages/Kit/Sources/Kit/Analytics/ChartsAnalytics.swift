import Foundation

/// Junta as respostas de `/palate`, `/stats` e `/timeline` num único `ChartsData`.
public enum ChartsAnalytics {
    public static func compute(palate: PalateData, stats: StatsData, timeline: TimelineData) -> ChartsData {
        ChartsData(
            totalFilms: palate.totalFilms,
            decades: palate.decades.map { DecadeBucket(decade: $0.decade, label: $0.label, count: $0.count) },
            countries: palate.countries.map { CountryCount(code: $0.code, count: $0.count) },
            genres: palate.genres.map { GenreCount(genre: $0.genre, count: $0.count) },
            runtimes: palate.runtimes.map {
                RuntimeBucket(label: $0.label, min: $0.min, max: $0.max, count: $0.count, sweetSpot: $0.sweetSpot)
            },
            contrarian: palate.contrarian.points.map {
                ContrarianPoint(id: $0.id, title: $0.title, year: $0.year, userRating: $0.userRating, crowdRating: $0.crowdRating, delta: $0.delta)
            },
            timelineYears: timeline.years.map { year in
                TimelineYear(
                    year: year.year,
                    sessions: year.sessions,
                    averageRating: year.averageRating,
                    tasteLean: year.tasteLean,
                    averageFilmYear: year.averageFilmYear,
                    genreShares: year.genreShares.map { GenreShare(genre: $0.genre, count: $0.count, share: $0.share) }
                )
            },
            topGenres: timeline.topGenres,
            ratingDistribution: stats.distribution.map { RatingBucket(rating: $0.rating, count: $0.count) },
            monthSeries: stats.monthSeries.map { MonthBucket(key: $0.key, count: $0.count) }
        )
    }
}

// MARK: - Tipos de dados

public struct DecadeBucket: Sendable, Equatable, Identifiable {
    public let decade: Int
    public let label: String
    public let count: Int
    public var id: Int { decade }
}

public struct CountryCount: Sendable, Equatable, Identifiable {
    public let code: String
    public let count: Int
    public var id: String { code }
}

public struct GenreCount: Sendable, Equatable, Identifiable {
    public let genre: String
    public let count: Int
    public var id: String { genre }
}

public struct RuntimeBucket: Sendable, Equatable, Identifiable {
    public let label: String
    public let min: Int
    /// Em minutos; `nil` na última faixa, que fica aberta.
    public let max: Int?
    public var count: Int
    /// Marca a faixa mais comum.
    public var sweetSpot: Bool
    public var id: String { label }
}

public struct ContrarianPoint: Sendable, Equatable, Identifiable {
    public let id: String
    public let title: String
    public let year: Int?
    public let userRating: Double
    /// Nota do público convertida para 0–5.
    public let crowdRating: Double
    /// Positiva quando o usuário gostou mais que o público.
    public let delta: Double
}

public struct GenreShare: Sendable, Equatable, Identifiable {
    public let genre: String
    public let count: Int
    /// Participação do gênero entre os filmes daquele ano.
    public let share: Double
    public var id: String { genre }
}

public struct TimelineYear: Sendable, Equatable, Identifiable {
    public let year: Int
    public let sessions: Int
    public let averageRating: Double?
    /// Diferença média para o público na escala 0–5; positiva = mais generoso.
    public let tasteLean: Double?
    public let averageFilmYear: Double?
    public let genreShares: [GenreShare]
    public var id: Int { year }
}

public struct RatingBucket: Sendable, Equatable, Identifiable {
    public let rating: Double
    public let count: Int
    public var id: Double { rating }
}

public struct MonthBucket: Sendable, Equatable, Identifiable {
    public let key: String
    public let count: Int
    public var id: String { key }
}

public struct ChartsData: Sendable, Equatable {
    /// Conta só os filmes avaliados.
    public let totalFilms: Int
    public let decades: [DecadeBucket]
    public let countries: [CountryCount]
    public let genres: [GenreCount]
    public let runtimes: [RuntimeBucket]
    public let contrarian: [ContrarianPoint]
    public let timelineYears: [TimelineYear]
    public let topGenres: [String]
    public let ratingDistribution: [RatingBucket]
    public let monthSeries: [MonthBucket]
}
