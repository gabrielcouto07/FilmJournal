import Foundation

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
        let response: Response = try await client.request(.patch, "/profile", body: request)
        return UpdateResult(profile: response.profile, message: response.message)
    }

    public func get() async throws -> Profile {
        let response: Response = try await client.request(.get, "/profile")
        return response.profile
    }
}
