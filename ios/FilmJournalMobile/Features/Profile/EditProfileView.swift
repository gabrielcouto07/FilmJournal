import SwiftUI
import PhotosUI
import Kit
import DesignKit

struct EditProfileView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var session: SessionController
    @StateObject private var viewModel = EditProfileViewModel()
    @State private var photoPickerItem: PhotosPickerItem?

    var body: some View {
        FJScreen("Editar perfil") {
        Form {
            Section("Foto") {
                HStack(spacing: Spacing.md) {
                    avatarPreview
                        .frame(width: 72, height: 72)
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        PhotosPicker(selection: $photoPickerItem, matching: .images) {
                            Text(viewModel.pickedAvatarPreview == nil ? "Escolher foto" : "Trocar foto")
                        }
                        if viewModel.pickedAvatarPreview != nil {
                            Button("Cancelar troca", role: .destructive) {
                                photoPickerItem = nil
                                viewModel.clearPickedImage()
                            }
                            .font(.footnote)
                        }
                    }
                }
                .padding(.vertical, Spacing.xs)
            }

            Section("Perfil") {
                TextField("Nome de exibição", text: $viewModel.displayName)
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
            await viewModel.prefill(from: session.currentUser, api: api)
        }
        .task(id: photoPickerItem) {
            guard let photoPickerItem, let data = try? await photoPickerItem.loadTransferable(type: Data.self) else { return }
            viewModel.setPickedImage(data: data)
        }
    }

    @ViewBuilder
    private var avatarPreview: some View {
        if let pickedImage = viewModel.pickedAvatarPreview {
            Image(uiImage: pickedImage)
                .resizable()
                .aspectRatio(contentMode: .fill)
        } else if let dataImage = viewModel.currentAvatarImage {
            Image(uiImage: dataImage)
                .resizable()
                .aspectRatio(contentMode: .fill)
        } else if let urlString = viewModel.currentAvatarUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                if case .success(let image) = phase {
                    image.resizable().aspectRatio(contentMode: .fill)
                } else {
                    avatarPlaceholder
                }
            }
        } else {
            avatarPlaceholder
        }
    }

    private var avatarPlaceholder: some View {
        Circle()
            .fill(Color.secondary.opacity(0.15))
            .overlay(Image(systemName: "person.fill").foregroundStyle(.secondary))
    }
}
