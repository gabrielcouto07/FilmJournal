import Foundation

/// `POST /api/onboarding` — semeia o perfil de gosto com até 5 filmes favoritos.
public final class OnboardingService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    public func submit(seeds: [OnboardingSeed]) async throws -> Int {
        let response: OnboardingResponse = try await client.request(.post, "/api/onboarding", body: OnboardingRequest(seeds: seeds))
        return response.seeded
    }
}
