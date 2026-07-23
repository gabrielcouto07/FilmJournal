import Foundation

/// Espelha `src/lib/analytics/palate.ts` e `src/lib/analytics/timeline.ts` do web — calcula os
/// dados dos gráficos da Home a partir do diário (`[LogEntry]`), sem depender de um endpoint
/// de estatísticas dedicado (que ainda não existe na API mobile).
public enum ChartsAnalytics {
    /// Escala de notas do usuário.
    public static let userScaleMax = 5.0
    /// Escala usada pelo TMDB.
    public static let crowdScaleMax = 10.0
    /// Mínimo de votos para a nota do público ser confiável.
    public static let minCrowdVotes = 50

    /// Converte a nota do público para a escala de 0 a 5.
    public static func normalizeCrowdRating(_ crowd: Double) -> Double {
        crowd * (userScaleMax / crowdScaleMax)
    }

    static func mean(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 0 }
        return values.reduce(0, +) / Double(values.count)
    }

    static func round(_ value: Double, places: Int = 2) -> Double {
        let factor = pow(10.0, Double(places))
        return (value * factor).rounded() / factor
    }

    /// Calcula todos os dados de gráfico a partir do diário completo do usuário.
    public static func compute(from logs: [LogEntry]) -> ChartsData {
        ChartsData(
            totalFilms: Set(logs.compactMap { $0.movie?.id }).count,
            decades: computeDecades(logs),
            countries: computeCountries(logs),
            genres: computeGenres(logs),
            runtimes: computeRuntimes(logs),
            contrarian: computeContrarian(logs),
            timelineYears: computeTimelineYears(logs),
            topGenres: computeTopGenres(logs),
            ratingDistribution: computeRatingDistribution(logs),
            monthSeries: computeMonthSeries(logs)
        )
    }

    // MARK: - Filmes avaliados (um por filme, deduplicado por rewatch)

    /// Um filme por `movieId`, usando a nota atual do filme (`Movie.rating`, mesclada do
    /// `UserMovie`) — não a nota da sessão. Mantém apenas filmes já avaliados.
    static func ratedFilms(from logs: [LogEntry]) -> [(movie: Movie, userRating: Double)] {
        var seen = Set<String>()
        var result: [(Movie, Double)] = []
        for log in logs {
            guard let movie = log.movie, let rating = movie.rating, !seen.contains(movie.id) else { continue }
            seen.insert(movie.id)
            result.append((movie, rating))
        }
        return result
    }

    static func genreList(from movie: Movie?) -> [String] {
        (movie?.genres ?? "")
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    // MARK: - Décadas

    static func computeDecades(_ logs: [LogEntry]) -> [DecadeBucket] {
        var counts: [Int: Int] = [:]
        for (movie, _) in ratedFilms(from: logs) {
            guard let year = movie.year else { continue }
            let decade = (year / 10) * 10
            counts[decade, default: 0] += 1
        }
        return counts.keys.sorted().map { decade in
            DecadeBucket(decade: decade, label: "\(decade)s", count: counts[decade] ?? 0)
        }
    }

    // MARK: - Países

    /// Conta filmes por país; coproduções entram uma vez em cada país.
    static func computeCountries(_ logs: [LogEntry], limit: Int? = nil) -> [CountryCount] {
        var counts: [String: Int] = [:]
        for (movie, _) in ratedFilms(from: logs) {
            for code in movie.countries where !code.isEmpty {
                counts[code, default: 0] += 1
            }
        }
        let ranked = counts
            .sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }
            .map { CountryCount(code: $0.key, count: $0.value) }
        guard let limit else { return ranked }
        return Array(ranked.prefix(limit))
    }

    // MARK: - Gêneros

    /// Conta filmes por gênero, do mais visto para o menos visto.
    static func computeGenres(_ logs: [LogEntry], limit: Int? = nil) -> [GenreCount] {
        var counts: [String: Int] = [:]
        for (movie, _) in ratedFilms(from: logs) {
            for genre in Set(genreList(from: movie)) {
                counts[genre, default: 0] += 1
            }
        }
        let ranked = counts
            .sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }
            .map { GenreCount(genre: $0.key, count: $0.value) }
        guard let limit else { return ranked }
        return Array(ranked.prefix(limit))
    }

    // MARK: - Duração

    static let runtimeBucketDefinitions: [(label: String, min: Int, max: Int?)] = [
        ("< 90", 0, 90),
        ("90–104", 90, 105),
        ("105–119", 105, 120),
        ("120–134", 120, 135),
        ("135–149", 135, 150),
        ("150+", 150, nil),
    ]

    /// Agrupa por duração e destaca a faixa mais comum.
    static func computeRuntimes(_ logs: [LogEntry]) -> [RuntimeBucket] {
        var counts = runtimeBucketDefinitions.map { RuntimeBucket(label: $0.label, min: $0.min, max: $0.max, count: 0, sweetSpot: false) }
        for (movie, _) in ratedFilms(from: logs) {
            guard let runtime = movie.runtime, runtime > 0 else { continue }
            guard let index = counts.firstIndex(where: { runtime >= $0.min && ($0.max == nil || runtime < $0.max!) }) else { continue }
            counts[index].count += 1
        }
        if let peak = counts.map(\.count).max(), peak > 0, let sweetIndex = counts.firstIndex(where: { $0.count == peak }) {
            counts[sweetIndex].sweetSpot = true
        }
        return counts
    }

    // MARK: - Comparação com o público

    /// Compara as notas usando apenas filmes com votos suficientes no TMDB.
    static func computeContrarian(_ logs: [LogEntry]) -> [ContrarianPoint] {
        ratedFilms(from: logs)
            .compactMap { movie, userRating -> ContrarianPoint? in
                guard let crowd = movie.tmdbRating, (movie.tmdbVoteCount ?? 0) >= minCrowdVotes else { return nil }
                let crowdRating = round(normalizeCrowdRating(crowd))
                return ContrarianPoint(
                    id: movie.id,
                    title: movie.title,
                    year: movie.year,
                    userRating: userRating,
                    crowdRating: crowdRating,
                    delta: round(userRating - crowdRating)
                )
            }
    }

    // MARK: - Evolução por ano (sessões do diário, sem deduplicar por filme)

    private static let utcCalendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        return calendar
    }()

    private static func entryDate(_ log: LogEntry) -> Date? { log.watchedAt ?? log.loggedAt }
    private static func entryYear(_ date: Date) -> Int { utcCalendar.component(.year, from: date) }

    static func computeTimelineYears(_ logs: [LogEntry]) -> [TimelineYear] {
        var byYear: [Int: [LogEntry]] = [:]
        for log in logs {
            guard let date = entryDate(log) else { continue }
            byYear[entryYear(date), default: []].append(log)
        }

        return byYear.keys.sorted().map { year in
            let group = byYear[year] ?? []
            let rated = group.compactMap(\.rating)
            let leans: [Double] = group.compactMap { log in
                guard let rating = log.rating, let crowd = log.movie?.tmdbRating, (log.movie?.tmdbVoteCount ?? 0) >= minCrowdVotes else { return nil }
                return rating - normalizeCrowdRating(crowd)
            }
            let filmYears = group.compactMap { $0.movie?.year }.map(Double.init)
            let withGenres = group.filter { !genreList(from: $0.movie).isEmpty }

            var genreCounts: [String: Int] = [:]
            for log in withGenres {
                for genre in Set(genreList(from: log.movie)) {
                    genreCounts[genre, default: 0] += 1
                }
            }
            let genreShares = genreCounts
                .sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }
                .map { genre, count in
                    GenreShare(genre: genre, count: count, share: round(Double(count) / Double(withGenres.count), places: 3))
                }

            return TimelineYear(
                year: year,
                sessions: group.count,
                averageRating: rated.isEmpty ? nil : round(mean(rated)),
                tasteLean: leans.isEmpty ? nil : round(mean(leans)),
                averageFilmYear: filmYears.isEmpty ? nil : round(mean(filmYears), places: 1),
                genreShares: genreShares
            )
        }
    }

    /// Principais gêneros entre todos os registros datados.
    static func computeTopGenres(_ logs: [LogEntry], limit: Int = 5) -> [String] {
        var counts: [String: Int] = [:]
        for log in logs {
            guard entryDate(log) != nil, let movie = log.movie else { continue }
            for genre in Set(genreList(from: movie)) {
                counts[genre, default: 0] += 1
            }
        }
        return counts
            .sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }
            .prefix(limit)
            .map(\.key)
    }

    // MARK: - Ritmo e escala de notas (todas as sessões, sem deduplicar)

    static func computeRatingDistribution(_ logs: [LogEntry]) -> [RatingBucket] {
        (1...10).map { step in
            let rating = Double(step) / 2
            let count = logs.filter { $0.rating == rating }.count
            return RatingBucket(rating: rating, count: count)
        }
    }

    static func computeMonthSeries(_ logs: [LogEntry], keep: Int = 18) -> [MonthBucket] {
        var counts: [String: Int] = [:]
        let formatter = DateFormatter()
        formatter.calendar = utcCalendar
        formatter.timeZone = utcCalendar.timeZone
        formatter.dateFormat = "yyyy-MM"
        for log in logs {
            guard let date = entryDate(log) else { continue }
            counts[formatter.string(from: date), default: 0] += 1
        }
        let sorted = counts.sorted { $0.key < $1.key }.map { MonthBucket(key: $0.key, count: $0.value) }
        return Array(sorted.suffix(keep))
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
    /// Limite mínimo em minutos.
    public let min: Int
    /// Limite máximo; `nil` deixa a última faixa aberta.
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

/// Pacote completo de dados para os gráficos da Home.
public struct ChartsData: Sendable, Equatable {
    /// Filmes distintos no diário (`LogEntry.movie`), assistidos ou não, avaliados ou não —
    /// usado para decidir se há dado suficiente para mostrar a seção de gráficos.
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
