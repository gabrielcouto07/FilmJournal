import Foundation
import Kit

@MainActor
final class LoginViewModel: ObservableObject {
    @Published var username = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    func login(session: SessionController) async {
        errorMessage = nil
        guard !username.trimmingCharacters(in: .whitespaces).isEmpty, !password.isEmpty else {
            errorMessage = "Preencha usuário e senha."
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            try await session.login(username: username, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
