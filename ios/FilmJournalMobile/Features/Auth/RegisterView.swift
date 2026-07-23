import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

struct RegisterView: View {
    @EnvironmentObject private var session: SessionController
    @StateObject private var viewModel = RegisterViewModel()

    var body: some View {
        FJScreen("Criar conta") {
        Form {
            Section("Nova conta") {
                TextField("Usuário", text: $viewModel.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("E-mail", text: $viewModel.email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                TextField("Nome de exibição (opcional)", text: $viewModel.displayName)
                SecureField("Senha", text: $viewModel.password)
            }

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Section {
                Button {
                    Task { await viewModel.register(session: session) }
                } label: {
                    HStack {
                        Text("Criar conta")
                        if viewModel.isLoading {
                            Spacer()
                            ProgressView()
                        }
                    }
                }
                .disabled(viewModel.isLoading)
            }
        }
        }
    }
}
