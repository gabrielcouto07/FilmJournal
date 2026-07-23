import SwiftUI
import Kit
import DesignKit

struct ChangeEmailView: View {
    @Environment(\.filmJournalAPI) private var api
    @StateObject private var viewModel = ChangeEmailViewModel()

    var body: some View {
        FJScreen("Trocar e-mail") {
        Form {
            Section("Novo e-mail") {
                TextField("novo@email.com", text: $viewModel.newEmail)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.emailAddress)
                SecureField("Senha atual", text: $viewModel.currentPassword)
            }

            if let successMessage = viewModel.successMessage {
                Text(successMessage).font(.footnote).foregroundStyle(.green)
            }
            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage).font(.footnote).foregroundStyle(.red)
            }

            Section {
                Button {
                    Task { await viewModel.submit(api: api) }
                } label: {
                    HStack {
                        Text("Trocar e-mail")
                        if viewModel.isLoading {
                            Spacer()
                            ProgressView()
                        }
                    }
                }
                .disabled(viewModel.isLoading || !viewModel.canSubmit)
            }
        }
        }
    }
}
