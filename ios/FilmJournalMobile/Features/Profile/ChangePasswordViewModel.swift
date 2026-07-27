import Foundation
import Kit

@MainActor
final class ChangePasswordViewModel: ObservableObject {
    @Published var currentPassword = ""
    @Published var newPassword = ""
    @Published var confirmationCode = ""
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var successMessage: String?
    @Published private(set) var maskedEmail: String?

    var canRequestChange: Bool {
        !currentPassword.isEmpty && newPassword.count >= 6
    }

    var canConfirm: Bool {
        confirmationCode.trimmingCharacters(in: .whitespaces).count == 6
    }

    // A senha só troca depois do código de 6 dígitos; aqui só dispara o e-mail.
    func requestChange(api: FilmJournalAPI) async -> Bool {
        errorMessage = nil
        successMessage = nil
        guard canRequestChange else {
            errorMessage = "Informe a senha atual e uma nova senha com pelo menos 6 caracteres."
            return false
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let response = try await api.account.requestPasswordChange(currentPassword: currentPassword, newPassword: newPassword)
            maskedEmail = response.email
            successMessage = response.message ?? "Código enviado."
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func confirmChange(api: FilmJournalAPI) async -> Bool {
        errorMessage = nil
        successMessage = nil
        guard canConfirm else {
            errorMessage = "Informe o código de 6 dígitos recebido por e-mail."
            return false
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let message = try await api.account.confirmPasswordChange(code: confirmationCode)
            successMessage = message ?? "Senha alterada com sucesso."
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
