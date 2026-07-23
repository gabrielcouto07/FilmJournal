import Foundation
import Kit

@MainActor
final class DeleteAccountViewModel: ObservableObject {
    @Published var currentPassword = ""
    @Published var confirmationText = ""
    @Published private(set) var isDeleting = false
    @Published var errorMessage: String?

    static let confirmationKeyword = "EXCLUIR"

    var canDelete: Bool {
        confirmationText == Self.confirmationKeyword && !currentPassword.isEmpty
    }

    /// Retorna `true` quando a conta foi excluída com sucesso (caller deve deslogar e resetar a navegação).
    func deleteAccount(api: FilmJournalAPI) async -> Bool {
        errorMessage = nil
        guard canDelete else {
            errorMessage = "Digite \"\(Self.confirmationKeyword)\" e informe sua senha atual para confirmar."
            return false
        }
        isDeleting = true
        defer { isDeleting = false }
        do {
            _ = try await api.account.deleteAccount(currentPassword: currentPassword)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
