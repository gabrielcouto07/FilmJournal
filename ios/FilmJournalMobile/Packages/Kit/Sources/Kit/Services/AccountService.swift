import Foundation

/// `/api/account/*` — exclusão de conta e troca de e-mail/senha.
public final class AccountService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    /// Exclui a conta atual. Bloqueado pelo backend para o usuário `OWNER`.
    public func deleteAccount(currentPassword: String) async throws -> String? {
        let response: MessageResponse = try await client.request(.delete, "/api/account", body: DeleteAccountRequest(currentPassword: currentPassword))
        return response.message
    }

    public func changeEmail(to email: String, currentPassword: String) async throws -> String? {
        let response: MessageResponse = try await client.request(.post, "/api/account/email", body: ChangeEmailRequest(email: email, currentPassword: currentPassword))
        return response.message
    }

    /// Passo 1: envia um código de confirmação de 6 dígitos por e-mail.
    public func requestPasswordChange(currentPassword: String, newPassword: String) async throws -> ChangePasswordResponse {
        try await client.request(.post, "/api/account/password", body: ChangePasswordRequest(currentPassword: currentPassword, newPassword: newPassword))
    }

    /// Passo 2: confirma o código de 6 dígitos recebido por e-mail.
    public func confirmPasswordChange(code: String) async throws -> String? {
        let response: MessageResponse = try await client.request(.post, "/api/account/password/confirm", body: ConfirmPasswordChangeRequest(code: code))
        return response.message
    }
}
