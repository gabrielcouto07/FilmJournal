import Foundation
import Kit

@MainActor
final class RegisterViewModel: ObservableObject {
    @Published var username = ""
    @Published var email = ""
    @Published var password = ""
    @Published var displayName = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    /// Cria a conta e, em seguida, já autentica (`POST /api/auth/register` só cria o usuário —
    /// o login continua sendo um passo separado no NextAuth).
    func register(session: SessionController) async -> Bool {
        errorMessage = nil
        guard username.count >= 3, password.count >= 8, email.contains("@") else {
            errorMessage = "Verifique usuário (mín. 3 caracteres), e-mail e senha (mín. 8 caracteres)."
            return false
        }
        isLoading = true
        defer { isLoading = false }
        do {
            _ = try await session.register(RegisterRequest(
                username: username,
                email: email,
                password: password,
                displayName: displayName.isEmpty ? nil : displayName
            ))
            try await session.login(username: username, password: password)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
