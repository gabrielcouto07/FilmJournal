import Foundation

public enum AppTheme: String, Codable, Sendable, CaseIterable { case system, dark, light }
public enum AppLanguage: String, Codable, Sendable, CaseIterable { case ptBR = "pt-BR", en }
public enum DateFormatPreference: String, Codable, Sendable, CaseIterable {
    case ddMMyyyy = "dd/MM/yyyy"
    case MMddyyyy = "MM/dd/yyyy"
    case yyyyMMdd = "yyyy-MM-dd"
}

/// Espelha `AppSettings` (`src/lib/settings.ts`).
public struct AppSettings: Codable, Sendable, Equatable {
    public var theme: AppTheme
    public var accentColor: String
    public var language: AppLanguage
    public var region: String
    public var dateFormat: DateFormatPreference
    public var defaultRatingScale: Int
    public var allowHalfStars: Bool
    public var showAdultContent: Bool
    public var emailNotifications: Bool

    public static let `default` = AppSettings(
        theme: .dark,
        accentColor: "#f5c518",
        language: .ptBR,
        region: "BR",
        dateFormat: .ddMMyyyy,
        defaultRatingScale: 5,
        allowHalfStars: true,
        showAdultContent: false,
        emailNotifications: false
    )
}

public struct SettingsResponse: Decodable, Sendable {
    public let settings: AppSettings
}

public struct SettingsUpdateResponse: Decodable, Sendable {
    public let settings: AppSettings
    public let message: String?
}

/// Corpo de `PATCH /api/settings` — todos os campos são opcionais (atualização parcial).
public struct SettingsUpdateRequest: Encodable, Sendable {
    public var theme: AppTheme?
    public var accentColor: String?
    public var language: AppLanguage?
    public var region: String?
    public var dateFormat: DateFormatPreference?
    public var defaultRatingScale: Int?
    public var allowHalfStars: Bool?
    public var showAdultContent: Bool?
    public var emailNotifications: Bool?

    public init(
        theme: AppTheme? = nil,
        accentColor: String? = nil,
        language: AppLanguage? = nil,
        region: String? = nil,
        dateFormat: DateFormatPreference? = nil,
        defaultRatingScale: Int? = nil,
        allowHalfStars: Bool? = nil,
        showAdultContent: Bool? = nil,
        emailNotifications: Bool? = nil
    ) {
        self.theme = theme
        self.accentColor = accentColor
        self.language = language
        self.region = region
        self.dateFormat = dateFormat
        self.defaultRatingScale = defaultRatingScale
        self.allowHalfStars = allowHalfStars
        self.showAdultContent = showAdultContent
        self.emailNotifications = emailNotifications
    }
}
