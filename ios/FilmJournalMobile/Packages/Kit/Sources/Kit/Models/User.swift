import Foundation

/// Espelha `session.user` do NextAuth (ver callbacks em `src/auth.config.ts`).
public struct User: Decodable, Sendable, Identifiable, Equatable {
    public let id: String
    public let username: String
    public let email: String?
    public let displayName: String?
    public let role: String

    public var isOwner: Bool { role == "OWNER" }
}

/// Resposta de `GET /api/auth/session` — `{}` quando deslogado.
public struct SessionResponse: Decodable, Sendable {
    public struct SessionUser: Decodable, Sendable {
        public let id: String
        public let username: String
        public let email: String?
        public let displayName: String?
        public let role: String
    }

    public let user: SessionUser?
    public let expires: String?
}

/// Perfil completo (`PATCH /api/profile`), separado de `User` pois inclui bio/avatar.
public struct Profile: Decodable, Sendable, Equatable {
    public let displayName: String?
    public let bio: String?
    public let avatarUrl: String?
}

public struct ProfileUpdateRequest: Encodable, Sendable {
    public var displayName: String?
    public var bio: String??
    public var avatarUrl: String??

    public init(displayName: String? = nil, bio: String?? = nil, avatarUrl: String?? = nil) {
        self.displayName = displayName
        self.bio = bio
        self.avatarUrl = avatarUrl
    }

    private enum CodingKeys: String, CodingKey { case displayName, bio, avatarUrl }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(displayName, forKey: .displayName)
        if let bio { try container.encode(bio, forKey: .bio) }
        if let avatarUrl { try container.encode(avatarUrl, forKey: .avatarUrl) }
    }
}
