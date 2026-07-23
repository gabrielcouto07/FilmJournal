import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

struct DeleteAccountView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var session: SessionController
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = DeleteAccountViewModel()

    var body: some View {
        FJScreen("Excluir conta") {
        Form {
            Section {
                Text("Esta ação é permanente e não pode ser desfeita. Todos os seus dados (diário, avaliações, listas) serão excluídos.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Confirmação") {
                Text("Digite \"\(DeleteAccountViewModel.confirmationKeyword)\" para confirmar.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                TextField(DeleteAccountViewModel.confirmationKeyword, text: $viewModel.confirmationText)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                SecureField("Senha atual", text: $viewModel.currentPassword)
            }

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage).font(.footnote).foregroundStyle(.red)
            }

            Section {
                Button(role: .destructive) {
                    Task {
                        if await viewModel.deleteAccount(api: api) {
                            await session.logout()
                            root.resetAllStacks()
                        }
                    }
                } label: {
                    HStack {
                        Text("Excluir minha conta")
                        if viewModel.isDeleting {
                            Spacer()
                            ProgressView()
                        }
                    }
                }
                .disabled(viewModel.isDeleting || !viewModel.canDelete)
            }
        }
        }
    }
}
