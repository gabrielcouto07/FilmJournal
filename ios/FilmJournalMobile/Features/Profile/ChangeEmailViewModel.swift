import Foundation
import Kit

@MainActor
final class ChangeEmailViewModel: ObservableObject {
    @Published var newEmail = ""
    @Published var currentPassword = ""
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    var canSubmit: Bool {
        !newEmail.trimmingCharacters(in: .whitespaces).isEmpty && !currentPassword.isEmpty
    }

    func submit(api: FilmJournalAPI) async {
        errorMessage = nil
        successMessage = nil
        guard canSubmit else {
            errorMessage = "Preencha o novo e-mail e a senha atual."
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let message = try await api.account.changeEmail(to: newEmail, currentPassword: currentPassword)
            successMessage = message ?? "E-mail atualizado com sucesso."
            currentPassword = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
