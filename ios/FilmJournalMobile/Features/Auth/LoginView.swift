import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

struct LoginView: View {
    @EnvironmentObject private var session: SessionController
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = LoginViewModel()

    var body: some View {
        FJScreen("FilmJournal") {
        Form {
            Section("Entrar") {
                TextField("Usuário", text: $viewModel.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Senha", text: $viewModel.password)
            }

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Section {
                Button {
                    Task { await viewModel.login(session: session) }
                } label: {
                    HStack {
                        Text("Entrar")
                        if viewModel.isLoading {
                            Spacer()
                            ProgressView()
                        }
                    }
                }
                .disabled(viewModel.isLoading)

                Button("Criar conta") {
                    root.authRouter.push(.register)
                }
            }
        }
        }
    }
}
