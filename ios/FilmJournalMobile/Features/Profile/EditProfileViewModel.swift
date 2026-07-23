import Foundation
import Kit

@MainActor
final class EditProfileViewModel: ObservableObject {
    @Published var displayName = ""
    @Published var bio = ""
    @Published var avatarUrl = ""
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    func prefill(from user: User?) {
        displayName = user?.displayName ?? ""
    }

    func save(api: FilmJournalAPI) async {
        errorMessage = nil
        successMessage = nil
        isLoading = true
        defer { isLoading = false }

        let trimmedName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBio = bio.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedAvatar = avatarUrl.trimmingCharacters(in: .whitespacesAndNewlines)

        // `bio`/`avatarUrl` são `String??`: só enviamos quando o usuário digitou algo,
        // deixando `nil` (nível externo) para "não altere esse campo".
        let bioUpdate: String?? = trimmedBio.isEmpty ? nil : .some(trimmedBio)
        let avatarUpdate: String?? = trimmedAvatar.isEmpty ? nil : .some(trimmedAvatar)

        do {
            let result = try await api.profile.update(
                ProfileUpdateRequest(
                    displayName: trimmedName.isEmpty ? nil : trimmedName,
                    bio: bioUpdate,
                    avatarUrl: avatarUpdate
                )
            )
            successMessage = result.message ?? "Perfil atualizado."
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
