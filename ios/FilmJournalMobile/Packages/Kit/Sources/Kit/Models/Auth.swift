import Foundation

public struct RegisterRequest: Encodable, Sendable {
    public var username: String
    public var email: String
    public var password: String
    public var displayName: String?

    public init(username: String, email: String, password: String, displayName: String? = nil) {
        self.username = username
        self.email = email
        self.password = password
        self.displayName = displayName
    }
}

public struct RegisterResponse: Decodable, Sendable {
    public let id: String
    public let username: String
}

public struct DeleteAccountRequest: Encodable, Sendable {
    public let confirm: String
    public let currentPassword: String

    public init(currentPassword: String) {
        self.confirm = "EXCLUIR"
        self.currentPassword = currentPassword
    }
}

public struct ChangeEmailRequest: Encodable, Sendable {
    public let email: String
    public let currentPassword: String

    public init(email: String, currentPassword: String) {
        self.email = email
        self.currentPassword = currentPassword
    }
}

public struct ChangePasswordRequest: Encodable, Sendable {
    public let currentPassword: String
    public let newPassword: String

    public init(currentPassword: String, newPassword: String) {
        self.currentPassword = currentPassword
        self.newPassword = newPassword
    }
}

public struct ChangePasswordResponse: Decodable, Sendable {
    public let message: String?
    /// E-mail mascarado (ex.: `"ga••••@dominio.com"`) para onde o código de confirmação foi enviado.
    public let email: String?
}

public struct ConfirmPasswordChangeRequest: Encodable, Sendable {
    public let code: String

    public init(code: String) {
        self.code = code
    }
}

public struct OnboardingSeed: Encodable, Sendable {
    public let tmdbId: Int
    public let rating: Double

    public init(tmdbId: Int, rating: Double) {
        self.tmdbId = tmdbId
        self.rating = rating
    }
}

public struct OnboardingRequest: Encodable, Sendable {
    public let seeds: [OnboardingSeed]

    public init(seeds: [OnboardingSeed]) {
        self.seeds = seeds
    }
}

public struct OnboardingResponse: Decodable, Sendable {
    public let seeded: Int
}
