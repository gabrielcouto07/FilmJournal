import SwiftUI
import Kit
import DesignKit

struct EditProfileView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var session: SessionController
    @StateObject private var viewModel = EditProfileViewModel()

    var body: some View {
        FJScreen("Editar perfil") {
        Form {
            Section("Perfil") {
                TextField("Nome de exibição", text: $viewModel.displayName)
                TextField("URL do avatar (https://…)", text: $viewModel.avatarUrl)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
            }

            Section("Bio") {
                TextEditor(text: $viewModel.bio)
                    .frame(minHeight: 100)
            }

            if let successMessage = viewModel.successMessage {
                Text(successMessage).font(.footnote).foregroundStyle(.green)
            }
            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage).font(.footnote).foregroundStyle(.red)
            }

            Section {
                Button {
                    Task { await viewModel.save(api: api) }
                } label: {
                    HStack {
                        Text("Salvar")
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
        .task {
            viewModel.prefill(from: session.currentUser)
        }
    }
}
