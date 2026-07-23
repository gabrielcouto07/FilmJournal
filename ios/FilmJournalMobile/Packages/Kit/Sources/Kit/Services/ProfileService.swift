import Foundation

/// `PATCH /api/profile`.
public final class ProfileService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    public struct UpdateResult {
        public let profile: Profile
        public let message: String?
    }

    private struct Response: Decodable {
        let profile: Profile
        let message: String?
    }

    public func update(_ request: ProfileUpdateRequest) async throws -> UpdateResult {
        let response: Response = try await client.request(.patch, "/api/profile", body: request)
        return UpdateResult(profile: response.profile, message: response.message)
    }
}
