import Foundation

/// Uma sessão de exibição do diário (`LogEntry`). Várias sessões podem existir para o mesmo
/// filme — o "estado atual" (nota corrente, favorito, watchlist) mora em `Movie`/`UserMovie`.
public struct LogEntry: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let movieId: String
    public let userId: String?
    public let sourceType: String
    public let sourceUri: String?
    public let loggedAt: Date?
    public let watchedAt: Date?
    public let rating: Double?
    public let review: String?
    public let favorite: Bool
    public let rewatch: Bool
    public let tags: String?
    public let createdAt: Date
    public let updatedAt: Date
    /// Presente em `GET /api/logs` (o filme já vem mesclado com o estado do usuário).
    public let movie: Movie?
}

public struct LogsListResponse: Decodable, Sendable {
    public let logs: [LogEntry]
}

public struct LogCreateResponse: Decodable, Sendable {
    public let log: LogEntry
    public let movie: Movie
    public let message: String?
}

public struct LogUpdateResponse: Decodable, Sendable {
    public let log: LogEntry
    public let message: String?
}

/// Corpo de `POST /api/logs`. `watchedAt` é uma data pura "AAAA-MM-DD", não `Date` — o backend
/// grava meio-dia UTC para evitar deslocamento de fuso.
public struct CreateLogRequest: Encodable, Sendable {
    public var movieId: String
    public var watchedAt: String?
    public var rating: Double?
    public var review: String?
    public var rewatch: Bool?
    public var tags: String?

    public init(movieId: String, watchedAt: Date? = nil, rating: Double? = nil, review: String? = nil, rewatch: Bool? = nil, tags: String? = nil) {
        self.movieId = movieId
        self.watchedAt = watchedAt.map(DayString.string(from:))
        self.rating = rating
        self.review = review
        self.rewatch = rewatch
        self.tags = tags
    }
}

/// Corpo de `PATCH /api/logs`. Cada campo opcional só é enviado (e alterado) quando presente.
public struct UpdateLogRequest: Encodable, Sendable {
    public var id: String
    public var rating: Double??
    public var review: String??
    public var watchedAt: String??
    public var rewatch: Bool?
    public var tags: String??
    public var favorite: Bool?

    public init(id: String) {
        self.id = id
    }

    private enum CodingKeys: String, CodingKey { case id, rating, review, watchedAt, rewatch, tags, favorite }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        if let rating { try container.encode(rating, forKey: .rating) }
        if let review { try container.encode(review, forKey: .review) }
        if let watchedAt { try container.encode(watchedAt, forKey: .watchedAt) }
        try container.encodeIfPresent(rewatch, forKey: .rewatch)
        if let tags { try container.encode(tags, forKey: .tags) }
        try container.encodeIfPresent(favorite, forKey: .favorite)
    }
}
