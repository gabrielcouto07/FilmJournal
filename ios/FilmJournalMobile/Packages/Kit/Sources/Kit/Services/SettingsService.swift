import Foundation

/// `/api/settings` — preferências do usuário (tema, idioma, escala de nota, etc.).
public final class SettingsService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    public func get() async throws -> AppSettings {
        let response: SettingsResponse = try await client.request(.get, "/api/settings")
        return response.settings
    }

    public func update(_ request: SettingsUpdateRequest) async throws -> AppSettings {
        let response: SettingsUpdateResponse = try await client.request(.patch, "/api/settings", body: request)
        return response.settings
    }
}
