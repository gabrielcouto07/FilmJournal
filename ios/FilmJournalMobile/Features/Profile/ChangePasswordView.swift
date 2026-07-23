import SwiftUI
import Kit
import DesignKit

struct ChangePasswordView: View {
    @Environment(\.filmJournalAPI) private var api
    @StateObject private var viewModel = ChangePasswordViewModel()
    @State private var step = 1

    var body: some View {
        FJScreen("Trocar senha") {
        Form {
            if step == 1 {
                Section("Trocar senha") {
                    SecureField("Senha atual", text: $viewModel.currentPassword)
                    SecureField("Nova senha", text: $viewModel.newPassword)
                }
            } else {
                Section("Confirmação") {
                    if let maskedEmail = viewModel.maskedEmail {
                        Text("Enviamos um código de 6 dígitos para \(maskedEmail).")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    TextField("Código de 6 dígitos", text: $viewModel.confirmationCode)
                        .keyboardType(.numberPad)
                }
            }

            if let successMessage = viewModel.successMessage {
                Text(successMessage).font(.footnote).foregroundStyle(.green)
            }
            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage).font(.footnote).foregroundStyle(.red)
            }

            Section {
                Button {
                    Task {
                        if step == 1 {
                            if await viewModel.requestChange(api: api) {
                                step = 2
                            }
                        } else {
                            _ = await viewModel.confirmChange(api: api)
                        }
                    }
                } label: {
                    HStack {
                        Text(step == 1 ? "Enviar código" : "Confirmar código")
                        if viewModel.isLoading {
                            Spacer()
                            ProgressView()
                        }
                    }
                }
                .disabled(viewModel.isLoading || (step == 1 ? !viewModel.canRequestChange : !viewModel.canConfirm))
            }
        }
        }
    }
}
