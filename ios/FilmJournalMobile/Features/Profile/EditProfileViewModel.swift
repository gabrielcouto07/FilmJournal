import Foundation
import UIKit
import Kit

@MainActor
final class EditProfileViewModel: ObservableObject {
    @Published var displayName = ""
    @Published var bio = ""
    /// URL remota do avatar atual (mostrada até o usuário escolher uma nova foto).
    @Published private(set) var currentAvatarUrl: String?
    /// Preview local da foto recém-escolhida (antes de virar data URL) — `nil` = não trocou.
    @Published private(set) var pickedAvatarPreview: UIImage?
    private var pickedAvatarDataURL: String?

    /// `AsyncImage`/`URLSession` não carregam `data:` URIs — quando o avatar atual foi salvo
    /// como base64 (upload anterior, do próprio app ou do web), decodificamos aqui na mão.
    var currentAvatarImage: UIImage? {
        guard let currentAvatarUrl, currentAvatarUrl.hasPrefix("data:"),
              let commaIndex = currentAvatarUrl.firstIndex(of: ",") else { return nil }
        let base64 = currentAvatarUrl[currentAvatarUrl.index(after: commaIndex)...]
        guard let data = Data(base64Encoded: String(base64)) else { return nil }
        return UIImage(data: data)
    }

    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    func prefill(from user: User?, api: FilmJournalAPI) async {
        displayName = user?.displayName ?? ""
        if let profile = try? await api.profile.get() {
            bio = profile.bio ?? ""
            currentAvatarUrl = profile.avatarUrl
        }
    }

    /// Recorta a foto num canvas quadrado (cover-fit, igual ao `fileToSquareDataUrl` do web) e
    /// codifica como JPEG base64 — a API aceita `data:image/...;base64,...` ou uma URL `https://`,
    /// nunca multipart.
    func setPickedImage(data: Data) {
        guard let image = UIImage(data: data) else { return }
        pickedAvatarPreview = image
        pickedAvatarDataURL = Self.squareJPEGDataURL(from: image)
    }

    func clearPickedImage() {
        pickedAvatarPreview = nil
        pickedAvatarDataURL = nil
    }

    func save(api: FilmJournalAPI) async {
        errorMessage = nil
        successMessage = nil
        isLoading = true
        defer { isLoading = false }

        let trimmedName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBio = bio.trimmingCharacters(in: .whitespacesAndNewlines)

        // `bio`/`avatarUrl` são `String??`: `nil` (nível externo) = não altere; só enviamos um
        // valor quando o usuário de fato mudou algo.
        let bioUpdate: String?? = trimmedBio.isEmpty ? .some(nil) : .some(trimmedBio)
        let avatarUpdate: String?? = pickedAvatarDataURL.map { .some($0) } ?? nil

        do {
            let result = try await api.profile.update(
                ProfileUpdateRequest(
                    displayName: trimmedName.isEmpty ? nil : trimmedName,
                    bio: bioUpdate,
                    avatarUrl: avatarUpdate
                )
            )
            if let newAvatarUrl = result.profile.avatarUrl {
                currentAvatarUrl = newAvatarUrl
            }
            pickedAvatarPreview = nil
            pickedAvatarDataURL = nil
            successMessage = result.message ?? "Perfil atualizado."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private static func squareJPEGDataURL(from image: UIImage, side: CGFloat = 256, quality: CGFloat = 0.82) -> String? {
        let size = CGSize(width: side, height: side)
        let renderer = UIGraphicsImageRenderer(size: size)
        let squared = renderer.image { _ in
            let originalSize = image.size
            guard originalSize.width > 0, originalSize.height > 0 else { return }
            let scale = max(side / originalSize.width, side / originalSize.height)
            let scaledSize = CGSize(width: originalSize.width * scale, height: originalSize.height * scale)
            let origin = CGPoint(x: (side - scaledSize.width) / 2, y: (side - scaledSize.height) / 2)
            image.draw(in: CGRect(origin: origin, size: scaledSize))
        }

        // Limite do backend: `z.string().max(300_000)` no valor inteiro (incluindo o prefixo
        // `data:image/jpeg;base64,`) — reduz a qualidade se, por algum motivo, ainda estourar.
        for candidateQuality in stride(from: quality, through: 0.3, by: -0.15) {
            guard let jpegData = squared.jpegData(compressionQuality: candidateQuality) else { continue }
            let dataURL = "data:image/jpeg;base64,\(jpegData.base64EncodedString())"
            if dataURL.count <= 300_000 { return dataURL }
        }
        return nil
    }
}
