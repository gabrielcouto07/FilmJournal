import Foundation

/// Espelha `api/src/lib/dashboard-data.ts`/`analytics/{palate,timeline,motifs,verdict}.ts` —
/// os mesmos dados que alimentam `TasteDashboard.tsx` no web, computados no servidor (nada
/// disso é recalculado no cliente, ao contrário do que a Home fazia antes com `ChartsAnalytics`).

// MARK: - /stats

public struct StatsRatingBucket: Decodable, Sendable, Equatable {
    public let rating: Double
    public let count: Int
}

public struct StatsMonthBucket: Decodable, Sendable, Equatable {
    public let key: String
    public let count: Int
}

public struct StatsRetro: Decodable, Sendable, Equatable {
    public let year: Int
    public let sessions: Int
    public let average: Double?
    public let reviews: Int
    public let topGenre: String?
    public let topDirector: String?
    public let busiestMonth: String?
}

public struct StatsData: Decodable, Sendable, Equatable {
    public let sessions: Int
    public let watchedCount: Int
    public let average: Double?
    public let reviews: Int
    public let rewatches: Int
    public let ratedCount: Int
    public let distribution: [StatsRatingBucket]
    public let maxRating: Int
    public let monthSeries: [StatsMonthBucket]
    public let maxMonth: Int
    public let retro: StatsRetro
}

// MARK: - /palate

public struct PalateContrarianPoint: Decodable, Sendable, Equatable, Identifiable {
    public let id: String
    public let title: String
    public let year: Int?
    public let userRating: Double
    public let crowdRating: Double
    public let delta: Double
}

public struct PalateContrarian: Decodable, Sendable, Equatable {
    public let points: [PalateContrarianPoint]
    public let contrarianScore: Double
    public let tasteLean: Double
    public let loves: [PalateContrarianPoint]
    public let pans: [PalateContrarianPoint]
    public let sampleSize: Int
}

public struct PalateDecadeBucket: Decodable, Sendable, Equatable {
    public let decade: Int
    public let label: String
    public let count: Int
}

public struct PalateCountryCount: Decodable, Sendable, Equatable {
    public let code: String
    public let count: Int
}

public struct PalateGenreCount: Decodable, Sendable, Equatable {
    public let genre: String
    public let count: Int
}

public struct PalateRuntimeBucket: Decodable, Sendable, Equatable {
    public let label: String
    public let min: Int
    public let max: Int?
    public let count: Int
    public let sweetSpot: Bool
}

public struct DirectorLoyalty: Decodable, Sendable, Equatable, Identifiable {
    public let directorId: Int?
    public let name: String
    public let count: Int
    public let averageRating: Double

    public var id: String { directorId.map(String.init) ?? name }
}

public struct Verdict: Decodable, Sendable, Equatable {
    public let headline: String?
    public let sentence: String?
    public let thin: Bool
}

public struct PalateData: Decodable, Sendable, Equatable {
    public let totalFilms: Int
    public let contrarian: PalateContrarian
    public let decades: [PalateDecadeBucket]
    public let countries: [PalateCountryCount]
    public let genres: [PalateGenreCount]
    public let runtimes: [PalateRuntimeBucket]
    public let directors: [DirectorLoyalty]
    public let verdict: Verdict
}

// MARK: - /timeline

public struct TimelineGenreShare: Decodable, Sendable, Equatable {
    public let genre: String
    public let count: Int
    public let share: Double
}

public struct TimelineYearData: Decodable, Sendable, Equatable {
    public let year: Int
    public let sessions: Int
    public let ratedCount: Int
    public let averageRating: Double?
    public let tasteLean: Double?
    public let leanSampleSize: Int
    public let averageFilmYear: Double?
    public let genreShares: [TimelineGenreShare]
}

public struct TimelineInsight: Decodable, Sendable, Equatable {
    public let year: Int
    public let sentences: [String]
}

public struct TimelineData: Decodable, Sendable, Equatable {
    public let years: [TimelineYearData]
    public let topGenres: [String]
    public let insights: [TimelineInsight]
    public let sampleSize: Int
}

// MARK: - /motifs

public struct Motif: Decodable, Sendable, Equatable, Identifiable {
    public let keyword: String
    public let label: String
    public let count: Int

    public var id: String { keyword }
}

public struct MotifSummary: Decodable, Sendable, Equatable {
    public let threshold: Double
    public let highlyRatedCount: Int
    public let motifs: [Motif]
    public let sentence: String?
}
